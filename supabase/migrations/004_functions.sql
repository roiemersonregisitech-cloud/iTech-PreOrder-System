-- ============================================================
-- Postgres Functions — Core Business Logic
-- Called via supabase.rpc() from server-side API routes ONLY
-- ============================================================

-- ============================================================
-- 4.1 Reserve Item (atomic, race-safe, with idempotency)
-- ============================================================
create or replace function reserve_item(
  p_branch_id uuid,
  p_product_id uuid,
  p_qty int,
  p_cashier_id uuid,
  p_customer_name text,
  p_customer_contact text,
  p_idempotency_key uuid default null
) returns uuid
language plpgsql
as $$
declare
  v_available int;
  v_timeout_minutes int;
  v_reservation_id uuid;
  v_existing_id uuid;
begin
  -- Idempotency check: if a reservation with this key already exists, return it
  if p_idempotency_key is not null then
    select id into v_existing_id
    from reservations
    where idempotency_key = p_idempotency_key;

    if v_existing_id is not null then
      return v_existing_id;
    end if;
  end if;

  -- Lock the inventory row for the duration of this transaction
  select (qty_on_hand - qty_reserved) into v_available
  from inventory
  where branch_id = p_branch_id and product_id = p_product_id
  for update;

  if v_available is null then
    raise exception 'INVENTORY_ROW_NOT_FOUND';
  end if;

  if v_available < p_qty then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  -- Resolve timeout: branch override if present, else global setting
  select coalesce(
    (select (value#>>'{}')::int from branch_settings
       where branch_id = p_branch_id and key = 'reservation_timeout_minutes'),
    (select (value#>>'{}')::int from settings where key = 'reservation_timeout_minutes'),
    30
  ) into v_timeout_minutes;

  -- Deduct from available stock
  update inventory
  set qty_reserved = qty_reserved + p_qty, updated_at = now()
  where branch_id = p_branch_id and product_id = p_product_id;

  -- Create the reservation
  insert into reservations (
    branch_id, product_id, qty, cashier_id,
    customer_name, customer_contact, status, expires_at, idempotency_key
  )
  values (
    p_branch_id, p_product_id, p_qty, p_cashier_id,
    p_customer_name, p_customer_contact, 'pending',
    now() + (v_timeout_minutes || ' minutes')::interval,
    p_idempotency_key
  )
  returning id into v_reservation_id;

  return v_reservation_id;
end;
$$;

-- ============================================================
-- 4.2 Cancel Reservation (atomic, with idempotency)
-- ============================================================
create or replace function cancel_reservation(
  p_reservation_id uuid,
  p_cancelled_by uuid,
  p_reason text,
  p_idempotency_key uuid default null
) returns void
language plpgsql
as $$
declare
  v_branch_id uuid;
  v_product_id uuid;
  v_qty int;
  v_status text;
  v_existing_key uuid;
begin
  -- Idempotency check for cancel
  if p_idempotency_key is not null then
    select cancel_idempotency_key into v_existing_key
    from reservations
    where id = p_reservation_id and cancel_idempotency_key = p_idempotency_key;

    if v_existing_key is not null then
      return; -- Already cancelled with this key, safe no-op
    end if;
  end if;

  -- Lock the reservation row
  select branch_id, product_id, qty, status
  into v_branch_id, v_product_id, v_qty, v_status
  from reservations
  where id = p_reservation_id
  for update;

  if v_status is null then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  if v_status <> 'pending' then
    raise exception 'RESERVATION_NOT_PENDING';
  end if;

  -- Release reserved stock
  update inventory
  set qty_reserved = qty_reserved - v_qty, updated_at = now()
  where branch_id = v_branch_id and product_id = v_product_id;

  -- Update reservation status
  update reservations
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = p_cancelled_by,
      cancel_reason = p_reason,
      cancel_idempotency_key = p_idempotency_key
  where id = p_reservation_id;
end;
$$;

-- ============================================================
-- 4.3 Release Expired Reservations (scheduled via pg_cron)
-- Includes audit log insertion per expired reservation
-- ============================================================
create or replace function release_expired_reservations() returns void
language plpgsql
as $$
declare
  v_reservation record;
begin
  -- Loop through each expired reservation to log individually
  for v_reservation in
    select r.id, r.branch_id, r.product_id, r.qty
    from reservations r
    where r.status = 'pending' and r.expires_at < now()
    for update of r
  loop
    -- Release the reserved quantity
    update inventory
    set qty_reserved = qty_reserved - v_reservation.qty, updated_at = now()
    where branch_id = v_reservation.branch_id
      and product_id = v_reservation.product_id;

    -- Mark as expired
    update reservations
    set status = 'expired'
    where id = v_reservation.id;

    -- Audit log entry (system-triggered, user_id = null)
    insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
    values (
      null,
      'reservation.auto_expire',
      'reservation',
      v_reservation.id,
      jsonb_build_object(
        'branch_id', v_reservation.branch_id,
        'product_id', v_reservation.product_id,
        'qty_released', v_reservation.qty
      )
    );
  end loop;
end;
$$;

-- ============================================================
-- 4.4 Confirm Downpayment → Generate Preorder Code (atomic, with idempotency)
-- Sequence rollover: Z9999 → AA0000 (double-letter), with audit notice
-- ============================================================
create or replace function confirm_downpayment(
  p_reservation_id uuid,
  p_amount numeric,
  p_created_by uuid,
  p_idempotency_key uuid default null
) returns text
language plpgsql
as $$
declare
  v_branch_id uuid;
  v_branch_code text;
  v_status text;
  v_letter text;  -- using text instead of char(1) to support multi-char like 'AA'
  v_number int;
  v_code text;
  v_existing_code text;
begin
  -- Idempotency check: if a preorder with this key already exists, return its code
  if p_idempotency_key is not null then
    select preorder_code into v_existing_code
    from preorders
    where idempotency_key = p_idempotency_key;

    if v_existing_code is not null then
      return v_existing_code;
    end if;
  end if;

  -- Lock the reservation row
  select r.branch_id, r.status, b.code
  into v_branch_id, v_status, v_branch_code
  from reservations r join branches b on b.id = r.branch_id
  where r.id = p_reservation_id
  for update of r;

  if v_status is null then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  if v_status <> 'pending' then
    raise exception 'RESERVATION_NOT_PENDING';
  end if;

  -- Lock the branch sequence row to guarantee a unique code
  select current_letter, current_number into v_letter, v_number
  from branch_sequences where branch_id = v_branch_id for update;

  if v_letter is null then
    -- Auto-initialize sequence if missing
    insert into branch_sequences (branch_id, current_letter, current_number)
    values (v_branch_id, 'A', 0)
    on conflict (branch_id) do nothing;
    v_letter := 'A';
    v_number := 0;
  end if;

  v_number := v_number + 1;

  if v_number > 9999 then
    v_number := 0;
    if v_letter = 'Z' then
      -- Rollover: Z9999 → AA0000
      v_letter := 'AA';
      -- Log a notice to audit_logs for super_admin visibility
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (
        p_created_by,
        'sequence.rollover',
        'branch',
        v_branch_id,
        jsonb_build_object(
          'message', 'Branch sequence rolled over from Z to AA',
          'branch_code', v_branch_code
        )
      );
    elsif length(v_letter) = 1 then
      v_letter := chr(ascii(v_letter) + 1);
    else
      -- Multi-char letter increment (AA→AB, AZ→BA, etc.)
      -- Simple implementation: increment last char, carry if needed
      declare
        v_chars text[];
        v_i int;
        v_carry boolean := true;
      begin
        v_chars := string_to_array(v_letter, null);
        for v_i in reverse length(v_letter)..1 loop
          if v_carry then
            if substr(v_letter, v_i, 1) = 'Z' then
              v_letter := overlay(v_letter placing 'A' from v_i for 1);
              v_carry := true;
            else
              v_letter := overlay(v_letter placing chr(ascii(substr(v_letter, v_i, 1)) + 1) from v_i for 1);
              v_carry := false;
            end if;
          end if;
        end loop;
        if v_carry then
          v_letter := 'A' || v_letter;
        end if;
      end;
    end if;
  end if;

  -- Update the sequence
  update branch_sequences set current_letter = v_letter, current_number = v_number
  where branch_id = v_branch_id;

  -- Build preorder code: e.g. ASUSAYAL-A0001
  v_code := v_branch_code || '-' || v_letter || lpad(v_number::text, 4, '0');

  -- Mark reservation as confirmed (stock stays deducted — now committed)
  update reservations set status = 'confirmed' where id = p_reservation_id;

  -- Create the preorder record
  insert into preorders (reservation_id, branch_id, preorder_code, downpayment_amount, created_by, idempotency_key)
  values (p_reservation_id, v_branch_id, v_code, p_amount, p_created_by, p_idempotency_key);

  return v_code;
end;
$$;
