-- ============================================================
-- Central/Internal Inventory System
-- Stock must flow: Central → Branch (via allocation)
-- Super admin manages central stock; branches receive allocations
-- ============================================================

-- 1. Add central warehouse quantity to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS central_qty integer NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_central_qty_check') THEN
    ALTER TABLE products ADD CONSTRAINT products_central_qty_check CHECK (central_qty >= 0);
  END IF;
END $$;

-- 2. Add stock to central inventory
CREATE OR REPLACE FUNCTION add_central_stock(p_product_id uuid, p_qty integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_qty <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  UPDATE products SET central_qty = central_qty + p_qty WHERE id = p_product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
END;
$$;

-- 3. Allocate from central to a branch
CREATE OR REPLACE FUNCTION allocate_central_to_branch(p_product_id uuid, p_branch_id uuid, p_qty integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_central integer;
BEGIN
  IF p_qty <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  SELECT central_qty INTO v_central FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF v_central < p_qty THEN
    RAISE EXCEPTION 'Insufficient central stock. Available: %, Requested: %', v_central, p_qty;
  END IF;
  UPDATE products SET central_qty = central_qty - p_qty WHERE id = p_product_id;
  INSERT INTO inventory (branch_id, product_id, qty_on_hand, qty_reserved)
  VALUES (p_branch_id, p_product_id, p_qty, 0)
  ON CONFLICT (branch_id, product_id)
  DO UPDATE SET qty_on_hand = inventory.qty_on_hand + p_qty, updated_at = now();
END;
$$;

-- 4. Reclaim stock from branch back to central
CREATE OR REPLACE FUNCTION reclaim_branch_to_central(p_product_id uuid, p_branch_id uuid, p_qty integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_on_hand integer; v_reserved integer;
BEGIN
  IF p_qty <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  SELECT qty_on_hand, qty_reserved INTO v_on_hand, v_reserved
  FROM inventory WHERE branch_id = p_branch_id AND product_id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No inventory record found'; END IF;
  IF (v_on_hand - v_reserved) < p_qty THEN
    RAISE EXCEPTION 'Cannot reclaim %. Available (non-reserved): %', p_qty, (v_on_hand - v_reserved);
  END IF;
  UPDATE inventory SET qty_on_hand = qty_on_hand - p_qty, updated_at = now()
  WHERE branch_id = p_branch_id AND product_id = p_product_id;
  UPDATE products SET central_qty = central_qty + p_qty WHERE id = p_product_id;
END;
$$;

-- 5. Transfer stock between branches (multi-destination)
CREATE OR REPLACE FUNCTION transfer_branch_stock(p_product_id uuid, p_source_branch_id uuid, p_destinations jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_on_hand integer; v_reserved integer; v_total_qty integer; v_dest record;
BEGIN
  SELECT COALESCE(SUM((d->>'qty')::integer), 0) INTO v_total_qty
  FROM jsonb_array_elements(p_destinations) d;
  IF v_total_qty <= 0 THEN RAISE EXCEPTION 'Total transfer quantity must be positive'; END IF;

  SELECT qty_on_hand, qty_reserved INTO v_on_hand, v_reserved
  FROM inventory WHERE branch_id = p_source_branch_id AND product_id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source branch inventory not found'; END IF;
  IF (v_on_hand - v_reserved) < v_total_qty THEN
    RAISE EXCEPTION 'Insufficient source stock. Available: %, Requested: %', (v_on_hand - v_reserved), v_total_qty;
  END IF;

  UPDATE inventory SET qty_on_hand = qty_on_hand - v_total_qty, updated_at = now()
  WHERE branch_id = p_source_branch_id AND product_id = p_product_id;

  FOR v_dest IN SELECT (d->>'branch_id')::uuid AS branch_id, (d->>'qty')::integer AS qty
    FROM jsonb_array_elements(p_destinations) d
  LOOP
    INSERT INTO inventory (branch_id, product_id, qty_on_hand, qty_reserved)
    VALUES (v_dest.branch_id, p_product_id, v_dest.qty, 0)
    ON CONFLICT (branch_id, product_id)
    DO UPDATE SET qty_on_hand = inventory.qty_on_hand + v_dest.qty, updated_at = now();
  END LOOP;
END;
$$;

-- 6. Flexible approve_allocation_request: custom quantity + source (Central or Branch)
DROP FUNCTION IF EXISTS approve_allocation_request(uuid, uuid, text);
DROP FUNCTION IF EXISTS approve_allocation_request(uuid, uuid, integer, text, uuid, text);

CREATE OR REPLACE FUNCTION approve_allocation_request(
  p_request_id uuid,
  p_approved_by uuid,
  p_approved_qty integer DEFAULT NULL,
  p_source_type text DEFAULT 'central',
  p_source_branch_id uuid DEFAULT NULL,
  p_admin_notes text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req record;
  v_final_qty integer;
  v_central integer;
  v_source_on_hand integer;
  v_source_reserved integer;
BEGIN
  SELECT * INTO v_req FROM allocation_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status != 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;

  v_final_qty := COALESCE(p_approved_qty, v_req.requested_qty);
  IF v_final_qty <= 0 THEN RAISE EXCEPTION 'Approved quantity must be positive'; END IF;

  IF p_source_type = 'central' THEN
    SELECT central_qty INTO v_central FROM products WHERE id = v_req.product_id FOR UPDATE;
    IF v_central < v_final_qty THEN
      RAISE EXCEPTION 'Insufficient central stock. Available: %, Requested: %', v_central, v_final_qty;
    END IF;

    UPDATE products SET central_qty = central_qty - v_final_qty WHERE id = v_req.product_id;
  ELSIF p_source_type = 'branch' THEN
    IF p_source_branch_id IS NULL THEN
      RAISE EXCEPTION 'Source branch must be specified when sourcing from a branch';
    END IF;
    IF p_source_branch_id = v_req.branch_id THEN
      RAISE EXCEPTION 'Source branch cannot be the requesting branch';
    END IF;

    SELECT qty_on_hand, qty_reserved INTO v_source_on_hand, v_source_reserved
    FROM inventory WHERE branch_id = p_source_branch_id AND product_id = v_req.product_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Source branch has no inventory for this product'; END IF;
    IF (v_source_on_hand - v_source_reserved) < v_final_qty THEN
      RAISE EXCEPTION 'Insufficient source branch stock. Available: %, Requested: %', (v_source_on_hand - v_source_reserved), v_final_qty;
    END IF;

    UPDATE inventory SET qty_on_hand = qty_on_hand - v_final_qty, updated_at = now()
    WHERE branch_id = p_source_branch_id AND product_id = v_req.product_id;
  ELSE
    RAISE EXCEPTION 'Invalid source type. Must be central or branch';
  END IF;

  -- Add to target requesting branch inventory
  INSERT INTO inventory (branch_id, product_id, qty_on_hand, qty_reserved)
  VALUES (v_req.branch_id, v_req.product_id, v_final_qty, 0)
  ON CONFLICT (branch_id, product_id)
  DO UPDATE SET qty_on_hand = inventory.qty_on_hand + v_final_qty, updated_at = now();

  -- Update request record
  UPDATE allocation_requests
  SET status = 'approved',
      processed_by = p_approved_by,
      admin_notes = COALESCE(p_admin_notes, ''),
      processed_at = now()
  WHERE id = p_request_id;
END;
$$;
