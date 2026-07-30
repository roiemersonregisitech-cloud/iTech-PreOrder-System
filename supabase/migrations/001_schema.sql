-- ============================================================
-- iTech PreOrder System — Schema Migration
-- Run this in Supabase SQL Editor (or via supabase db push)
-- ============================================================

-- 1. Branches
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,          -- e.g. 'ASUSAYAL', used as preorder prefix
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Products
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text,
  unit_price numeric(12,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Inventory
create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  product_id uuid not null references products(id),
  qty_on_hand int not null default 0 check (qty_on_hand >= 0),
  qty_reserved int not null default 0 check (qty_reserved >= 0),
  updated_at timestamptz not null default now(),
  unique (branch_id, product_id)
);
-- qty_available is ALWAYS derived as (qty_on_hand - qty_reserved). Never stored.

-- 4. Staff (linked to auth.users)
create table if not exists staff (
  id uuid primary key references auth.users(id),
  branch_id uuid references branches(id),   -- null only for super_admin
  full_name text not null,
  role text not null check (role in ('cashier','branch_admin','super_admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 5. Reservations
create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  product_id uuid not null references products(id),
  qty int not null check (qty > 0),
  cashier_id uuid not null references staff(id),
  customer_name text,
  customer_contact text,
  status text not null check (status in ('pending','confirmed','expired','cancelled')) default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  cancelled_at timestamptz,
  cancelled_by uuid references staff(id),
  cancel_reason text,
  -- Idempotency keys for double-submit protection (§11)
  idempotency_key uuid unique,
  cancel_idempotency_key uuid unique
);
create index on reservations (status, expires_at);
create index on reservations (branch_id, status);

-- 6. Preorders
create table if not exists preorders (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references reservations(id),
  branch_id uuid not null references branches(id),
  preorder_code text not null unique,   -- e.g. ASUSAYAL-A0001
  downpayment_amount numeric(12,2) not null,
  downpayment_received_at timestamptz not null default now(),
  status text not null check (status in ('active','fulfilled','cancelled')) default 'active',
  created_by uuid not null references staff(id),
  created_at timestamptz not null default now(),
  -- Idempotency key for double-submit protection (§11)
  idempotency_key uuid unique
);

-- 7. Branch sequences (for preorder code generation)
create table if not exists branch_sequences (
  branch_id uuid primary key references branches(id),
  current_letter char(1) not null default 'A',
  current_number int not null default 0
);

-- 8. Global settings
create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references staff(id)
);

-- 9. Branch-specific settings (overrides global settings)
create table if not exists branch_settings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references staff(id),
  unique (branch_id, key)
);

-- 10. Audit logs
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references staff(id),
  action text not null,               -- e.g. 'reservation.create', 'reservation.cancel', etc.
  entity_type text,
  entity_id uuid,
  ip_address text,
  user_agent text,
  device_type text,
  browser text,
  os text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index on audit_logs (user_id, created_at desc);
create index on audit_logs (action, created_at desc);
create index on audit_logs (entity_type, entity_id);

-- ============================================================
-- Enable RLS on ALL tables
-- ============================================================
alter table branches enable row level security;
alter table products enable row level security;
alter table inventory enable row level security;
alter table staff enable row level security;
alter table reservations enable row level security;
alter table preorders enable row level security;
alter table branch_sequences enable row level security;
alter table settings enable row level security;
alter table branch_settings enable row level security;
alter table audit_logs enable row level security;
