-- 011_preorder_actions.sql

-- Revert a delivered/fulfilled preorder back to active
CREATE OR REPLACE FUNCTION revert_preorder_delivered(
  p_preorder_id UUID,
  p_reverted_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_preorder preorders%ROWTYPE;
  v_reservation reservations%ROWTYPE;
  v_delivery delivered_items%ROWTYPE;
BEGIN
  -- Lock preorder row
  SELECT * INTO v_preorder FROM preorders WHERE id = p_preorder_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PREORDER_NOT_FOUND';
  END IF;

  IF v_preorder.status != 'fulfilled' THEN
    RAISE EXCEPTION 'PREORDER_NOT_FULFILLED';
  END IF;

  -- Get reservation details
  SELECT * INTO v_reservation FROM reservations WHERE id = v_preorder.reservation_id;

  -- Get delivery details
  SELECT * INTO v_delivery FROM delivered_items WHERE preorder_id = p_preorder_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DELIVERY_NOT_FOUND';
  END IF;

  -- 1. Restore branch inventory (increment both qty_on_hand and qty_reserved)
  UPDATE inventory
  SET 
    qty_on_hand = qty_on_hand + v_delivery.qty,
    qty_reserved = qty_reserved + v_delivery.qty,
    updated_at = NOW()
  WHERE branch_id = v_preorder.branch_id AND product_id = v_reservation.product_id;

  -- 2. Delete delivery record
  DELETE FROM delivered_items WHERE preorder_id = p_preorder_id;

  -- 3. Update preorder status back to active
  UPDATE preorders
  SET 
    status = 'active',
    updated_at = NOW()
  WHERE id = p_preorder_id;

  RETURN jsonb_build_object(
    'preorder_code', v_preorder.preorder_code,
    'qty_reverted', v_delivery.qty
  );
END;
$$;


-- Cancel an active preorder (releases inventory reservation)
CREATE OR REPLACE FUNCTION cancel_preorder(
  p_preorder_id UUID,
  p_cancelled_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_preorder preorders%ROWTYPE;
  v_reservation reservations%ROWTYPE;
BEGIN
  -- Lock preorder row
  SELECT * INTO v_preorder FROM preorders WHERE id = p_preorder_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PREORDER_NOT_FOUND';
  END IF;

  IF v_preorder.status != 'active' THEN
    RAISE EXCEPTION 'PREORDER_NOT_ACTIVE';
  END IF;

  -- Get reservation details
  SELECT * INTO v_reservation FROM reservations WHERE id = v_preorder.reservation_id;

  -- 1. Release branch inventory (decrement qty_reserved)
  UPDATE inventory
  SET 
    qty_reserved = qty_reserved - v_reservation.qty,
    updated_at = NOW()
  WHERE branch_id = v_preorder.branch_id AND product_id = v_reservation.product_id;

  -- 2. Update preorder status to cancelled
  UPDATE preorders
  SET 
    status = 'cancelled',
    updated_at = NOW()
  WHERE id = p_preorder_id;

  RETURN jsonb_build_object(
    'preorder_code', v_preorder.preorder_code,
    'qty_released', v_reservation.qty
  );
END;
$$;
