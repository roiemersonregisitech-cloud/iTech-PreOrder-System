-- ============================================================
-- Migration 006: Product Allocation & Stock Request Management
-- ============================================================

-- 1. Allocation Requests Table
create table if not exists allocation_requests (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  requested_qty int not null check (requested_qty > 0),
  reason text,
  status text not null check (status in ('pending', 'approved', 'rejected')) default 'pending',
  requested_by uuid not null references staff(id),
  processed_by uuid references staff(id),
  admin_notes text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table allocation_requests enable row level security;

-- Permissive RLS for authenticated staff (scoping handled in API)
create policy "Authenticated staff can view allocation requests"
  on allocation_requests for select
  to authenticated
  using (true);

create policy "Authenticated staff can create allocation requests"
  on allocation_requests for insert
  to authenticated
  with check (true);

-- 2. Function: Request Allocation
create or replace function request_allocation(
  p_branch_id uuid,
  p_product_id uuid,
  p_requested_qty int,
  p_requested_by uuid,
  p_reason text default null
) returns uuid
language plpgsql
as $$
declare
  v_request_id uuid;
begin
  insert into allocation_requests (branch_id, product_id, requested_qty, requested_by, reason)
  values (p_branch_id, p_product_id, p_requested_qty, p_requested_by, p_reason)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

-- 3. Function: Approve Allocation Request
create or replace function approve_allocation_request(
  p_request_id uuid,
  p_approved_by uuid,
  p_admin_notes text default null
) returns void
language plpgsql
as $$
declare
  v_branch_id uuid;
  v_product_id uuid;
  v_qty int;
  v_status text;
begin
  select branch_id, product_id, requested_qty, status
  into v_branch_id, v_product_id, v_qty, v_status
  from allocation_requests
  where id = p_request_id
  for update;

  if v_status is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  if v_status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING';
  end if;

  -- Ensure inventory row exists and update qty_on_hand
  insert into inventory (branch_id, product_id, qty_on_hand, qty_reserved)
  values (v_branch_id, v_product_id, v_qty, 0)
  on conflict (branch_id, product_id)
  do update set qty_on_hand = inventory.qty_on_hand + v_qty, updated_at = now();

  -- Mark request as approved
  update allocation_requests
  set status = 'approved',
      processed_by = p_approved_by,
      admin_notes = p_admin_notes,
      processed_at = now()
  where id = p_request_id;

  -- Audit log
  insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
  values (
    p_approved_by,
    'allocation.approve',
    'allocation_request',
    p_request_id,
    jsonb_build_object(
      'branch_id', v_branch_id,
      'product_id', v_product_id,
      'allocated_qty', v_qty,
      'notes', p_admin_notes
    )
  );
end;
$$;

-- 4. Function: Reject Allocation Request
create or replace function reject_allocation_request(
  p_request_id uuid,
  p_rejected_by uuid,
  p_admin_notes text default null
) returns void
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status
  from allocation_requests
  where id = p_request_id
  for update;

  if v_status is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  if v_status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING';
  end if;

  update allocation_requests
  set status = 'rejected',
      processed_by = p_rejected_by,
      admin_notes = p_admin_notes,
      processed_at = now()
  where id = p_request_id;

  insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
  values (
    p_rejected_by,
    'allocation.reject',
    'allocation_request',
    p_request_id,
    jsonb_build_object('notes', p_admin_notes)
  );
end;
$$;

-- 5. Function: Direct Allocation Adjustment (Add or Reclaim)
create or replace function adjust_branch_allocation(
  p_branch_id uuid,
  p_product_id uuid,
  p_action text, -- 'add' or 'reclaim'
  p_qty int,
  p_admin_id uuid,
  p_reason text default null
) returns void
language plpgsql
as $$
declare
  v_current_on_hand int;
  v_current_reserved int;
begin
  if p_action not in ('add', 'reclaim') then
    raise exception 'INVALID_ACTION';
  end if;

  if p_qty <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  -- Ensure inventory row exists
  insert into inventory (branch_id, product_id, qty_on_hand, qty_reserved)
  values (p_branch_id, p_product_id, 0, 0)
  on conflict (branch_id, product_id) do nothing;

  select qty_on_hand, qty_reserved
  into v_current_on_hand, v_current_reserved
  from inventory
  where branch_id = p_branch_id and product_id = p_product_id
  for update;

  if p_action = 'add' then
    update inventory
    set qty_on_hand = qty_on_hand + p_qty, updated_at = now()
    where branch_id = p_branch_id and product_id = p_product_id;
  elsif p_action = 'reclaim' then
    if (v_current_on_hand - p_qty) < v_current_reserved then
      raise exception 'CANNOT_RECLAIM_RESERVED_STOCK';
    end if;

    update inventory
    set qty_on_hand = greatest(0, qty_on_hand - p_qty), updated_at = now()
    where branch_id = p_branch_id and product_id = p_product_id;
  end if;

  insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
  values (
    p_admin_id,
    'allocation.direct_' || p_action,
    'inventory',
    p_branch_id,
    jsonb_build_object(
      'branch_id', p_branch_id,
      'product_id', p_product_id,
      'action', p_action,
      'qty', p_qty,
      'reason', p_reason
    )
  );
end;
$$;
