-- ============================================================
-- Add customer_address to reservations and delivered_items
-- ============================================================

-- Add optional address column to reservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS customer_address text;

-- Add optional address column to delivered_items
ALTER TABLE delivered_items ADD COLUMN IF NOT EXISTS customer_address text;

-- ============================================================
-- Update reserve_item() to accept customer_address
-- ============================================================
CREATE OR REPLACE FUNCTION reserve_item(
  p_branch_id uuid,
  p_product_id uuid,
  p_qty int,
  p_cashier_id uuid,
  p_customer_name text,
  p_customer_contact text,
  p_idempotency_key uuid default null,
  p_customer_address text default null
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_available int;
  v_timeout_minutes int;
  v_reservation_id uuid;
  v_existing_id uuid;
BEGIN
  -- Idempotency check: if a reservation with this key already exists, return it
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM reservations
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  -- Lock the inventory row for the duration of this transaction
  SELECT (qty_on_hand - qty_reserved) INTO v_available
  FROM inventory
  WHERE branch_id = p_branch_id AND product_id = p_product_id
  FOR UPDATE;

  IF v_available IS NULL THEN
    RAISE EXCEPTION 'INVENTORY_ROW_NOT_FOUND';
  END IF;

  IF v_available < p_qty THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  -- Resolve timeout: branch override if present, else global setting
  SELECT coalesce(
    (SELECT (value#>>'{}')::int FROM branch_settings
       WHERE branch_id = p_branch_id AND key = 'reservation_timeout_minutes'),
    (SELECT (value#>>'{}')::int FROM settings WHERE key = 'reservation_timeout_minutes'),
    30
  ) INTO v_timeout_minutes;

  -- Deduct from available stock
  UPDATE inventory
  SET qty_reserved = qty_reserved + p_qty, updated_at = now()
  WHERE branch_id = p_branch_id AND product_id = p_product_id;

  -- Create the reservation
  INSERT INTO reservations (
    branch_id, product_id, qty, cashier_id,
    customer_name, customer_contact, customer_address, status, expires_at, idempotency_key
  )
  VALUES (
    p_branch_id, p_product_id, p_qty, p_cashier_id,
    p_customer_name, p_customer_contact, p_customer_address, 'pending',
    now() + (v_timeout_minutes || ' minutes')::interval,
    p_idempotency_key
  )
  RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$;

-- ============================================================
-- Update mark_preorder_delivered() to copy customer_address
-- ============================================================
CREATE OR REPLACE FUNCTION mark_preorder_delivered(
  p_preorder_id uuid,
  p_delivered_by uuid,
  p_sales_order_number text
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_preorder preorders%ROWTYPE;
  v_reservation reservations%ROWTYPE;
  v_delivered_id uuid;
BEGIN
  -- Lock the preorder row
  SELECT * INTO v_preorder FROM preorders WHERE id = p_preorder_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PREORDER_NOT_FOUND';
  END IF;
  IF v_preorder.status != 'active' THEN
    RAISE EXCEPTION 'PREORDER_NOT_ACTIVE';
  END IF;

  -- Fetch the linked reservation
  SELECT * INTO v_reservation FROM reservations WHERE id = v_preorder.reservation_id;

  -- Mark preorder as fulfilled
  UPDATE preorders SET status = 'fulfilled' WHERE id = p_preorder_id;

  -- Insert into delivered_items
  INSERT INTO delivered_items (
    preorder_id, reservation_id, branch_id, product_id, qty,
    sales_order_number, delivered_by,
    customer_name, customer_contact, customer_address,
    preorder_code, downpayment_amount
  )
  VALUES (
    p_preorder_id, v_preorder.reservation_id, v_preorder.branch_id,
    v_reservation.product_id, v_reservation.qty,
    p_sales_order_number, p_delivered_by,
    v_reservation.customer_name, v_reservation.customer_contact, v_reservation.customer_address,
    v_preorder.preorder_code, v_preorder.downpayment_amount
  )
  RETURNING id INTO v_delivered_id;

  RETURN v_delivered_id;
END;
$$;
