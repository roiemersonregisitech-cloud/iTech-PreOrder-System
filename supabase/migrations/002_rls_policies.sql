-- ============================================================
-- RLS Policies
-- Principle: anon can do NOTHING. authenticated gets scoped reads.
-- All writes go through server-side API routes using service role key.
-- ============================================================

-- Helper function: get current user's staff record
create or replace function get_my_staff()
returns staff
language sql
security definer
stable
as $$
  select * from staff where id = auth.uid() and is_active = true limit 1;
$$;

-- Helper function: get current user's role
create or replace function get_my_role()
returns text
language sql
security definer
stable
as $$
  select role from staff where id = auth.uid() and is_active = true limit 1;
$$;

-- Helper function: get current user's branch_id
create or replace function get_my_branch_id()
returns uuid
language sql
security definer
stable
as $$
  select branch_id from staff where id = auth.uid() and is_active = true limit 1;
$$;

-- ============================================================
-- BRANCHES: all authenticated staff can read active branches
-- ============================================================
create policy "staff_read_branches" on branches
  for select to authenticated
  using (true);

-- No direct write policies — managed via service role

-- ============================================================
-- PRODUCTS: all authenticated staff can read active products
-- ============================================================
create policy "staff_read_products" on products
  for select to authenticated
  using (true);

-- ============================================================
-- INVENTORY: staff can read their branch; super_admin reads all
-- ============================================================
create policy "staff_read_inventory" on inventory
  for select to authenticated
  using (
    branch_id = get_my_branch_id()
    or get_my_role() = 'super_admin'
  );

-- ============================================================
-- STAFF: own row + branch_admin sees branch + super_admin sees all
-- ============================================================
create policy "staff_read_own" on staff
  for select to authenticated
  using (
    id = auth.uid()
    or (get_my_role() = 'branch_admin' and branch_id = get_my_branch_id())
    or get_my_role() = 'super_admin'
  );

-- ============================================================
-- RESERVATIONS: branch-scoped read
-- ============================================================
create policy "staff_read_reservations" on reservations
  for select to authenticated
  using (
    branch_id = get_my_branch_id()
    or get_my_role() = 'super_admin'
  );

-- ============================================================
-- PREORDERS: branch-scoped read
-- ============================================================
create policy "staff_read_preorders" on preorders
  for select to authenticated
  using (
    branch_id = get_my_branch_id()
    or get_my_role() = 'super_admin'
  );

-- ============================================================
-- BRANCH_SEQUENCES: no direct access needed from client
-- ============================================================
-- (managed entirely via server-side RPC)

-- ============================================================
-- SETTINGS: all authenticated can read, only super_admin writes (via service role)
-- ============================================================
create policy "staff_read_settings" on settings
  for select to authenticated
  using (true);

-- ============================================================
-- BRANCH_SETTINGS: branch-scoped read + super_admin reads all
-- ============================================================
create policy "staff_read_branch_settings" on branch_settings
  for select to authenticated
  using (
    branch_id = get_my_branch_id()
    or get_my_role() = 'super_admin'
  );

-- ============================================================
-- AUDIT_LOGS: branch_admin sees their branch, super_admin sees all
-- Read-only from client; inserts done server-side via service role.
-- ============================================================
create policy "admin_read_audit_logs" on audit_logs
  for select to authenticated
  using (
    get_my_role() = 'super_admin'
    or (
      get_my_role() = 'branch_admin'
      and (
        -- logs that reference the user's branch via metadata
        -- or logs created by staff in the same branch
        user_id in (select id from staff where branch_id = get_my_branch_id())
      )
    )
  );
