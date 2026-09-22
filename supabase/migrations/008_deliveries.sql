-- ============================================================
-- Deliveries System — Track fulfilled preorders
-- When a customer picks up their preorder, staff marks it
-- "Delivered" which deducts from on_hand and releases reserved qty.
-- A Sales Order number (S0001, S0002, ...) is generated.
-- ============================================================

-- 1. Delivered items table
CREATE TABLE IF NOT EXISTS delivered_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preorder_id uuid NOT NULL UNIQUE REFERENCES preorders(id),
  reservation_id uuid NOT NULL REFERENCES reservations(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  product_id uuid NOT NULL REFERENCES products(id),
  qty int NOT NULL CHECK (qty > 0),
  sales_order_number text NOT NULL UNIQUE,       -- e.g. S0001
  delivered_by uuid NOT NULL REFERENCES staff(id),
  delivered_at timestamptz NOT NULL DEFAULT now(),
  -- Snapshot fields for historical record
  customer_name text,
  customer_contact text,
  preorder_code text NOT NULL,
  downpayment_amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivered_items_branch ON delivered_items (branch_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivered_items_sales_order ON delivered_items (sales_order_number);
CREATE INDEX IF NOT EXISTS idx_delivered_items_preorder_code ON delivered_items (preorder_code);

-- 2. Sales order sequence table (global counter)
CREATE TABLE IF NOT EXISTS sales_order_sequence (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),   -- singleton row
  current_number int NOT NULL DEFAULT 0
);
INSERT INTO sales_order_sequence (id, current_number) VALUES (1, 0) ON CONFLICT DO NOTHING;

-- 3. Enable RLS
ALTER TABLE delivered_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_sequence ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies (service role bypasses; these are for direct access)
CREATE POLICY "Service role full access on delivered_items"
  ON delivered_items FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on sales_order_sequence"
  ON sales_order_sequence FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Atomic function: mark_preorder_delivered
-- Validates preorder code match, generates sales order number,
-- deducts from inventory, marks preorder as fulfilled.
CREATE OR REPLACE FUNCTION mark_preorder_delivered(
  p_preorder_id uuid,
  p_preorder_code_confirm text,   -- staff re-types this for verification
  p_delivered_by uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_preorder record;
  v_reservation record;
  v_so_number int;
  v_sales_order text;
  v_delivered_id uuid;
BEGIN
  -- Lock and fetch the preorder
  SELECT p.*, b.code AS branch_code
  INTO v_preorder
  FROM preorders p
  JOIN branches b ON b.id = p.branch_id
  WHERE p.id = p_preorder_id
  FOR UPDATE OF p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PREORDER_NOT_FOUND';
  END IF;

  IF v_preorder.status <> 'active' THEN
    RAISE EXCEPTION 'PREORDER_NOT_ACTIVE';
  END IF;

  -- Verify the re-typed preorder code matches
  IF v_preorder.preorder_code <> p_preorder_code_confirm THEN
    RAISE EXCEPTION 'PREORDER_CODE_MISMATCH';
  END IF;

  -- Fetch the linked reservation
  SELECT * INTO v_reservation
  FROM reservations
  WHERE id = v_preorder.reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND';
  END IF;

  -- Generate Sales Order number: S0001, S0002, ...
  UPDATE sales_order_sequence
  SET current_number = current_number + 1
  WHERE id = 1
  RETURNING current_number INTO v_so_number;

  v_sales_order := 'S' || lpad(v_so_number::text, 4, '0');

  -- Deduct from inventory:
  --   qty_on_hand  -= qty  (physical stock left the building)
  --   qty_reserved -= qty  (reservation lock released)
  UPDATE inventory
  SET qty_on_hand  = qty_on_hand  - v_reservation.qty,
      qty_reserved = qty_reserved - v_reservation.qty,
      updated_at   = now()
  WHERE branch_id = v_reservation.branch_id
    AND product_id = v_reservation.product_id;

  -- Mark preorder as fulfilled
  UPDATE preorders SET status = 'fulfilled' WHERE id = p_preorder_id;

  -- Insert delivered item record
  INSERT INTO delivered_items (
    preorder_id, reservation_id, branch_id, product_id, qty,
    sales_order_number, delivered_by,
    customer_name, customer_contact, preorder_code, downpayment_amount
  )
  VALUES (
    p_preorder_id, v_preorder.reservation_id, v_reservation.branch_id,
    v_reservation.product_id, v_reservation.qty,
    v_sales_order, p_delivered_by,
    v_reservation.customer_name, v_reservation.customer_contact,
    v_preorder.preorder_code, v_preorder.downpayment_amount
  )
  RETURNING id INTO v_delivered_id;

  RETURN jsonb_build_object(
    'delivered_id', v_delivered_id,
    'sales_order_number', v_sales_order,
    'preorder_code', v_preorder.preorder_code,
    'qty', v_reservation.qty
  );
END;
$$;
