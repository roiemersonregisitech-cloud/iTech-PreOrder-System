-- ============================================================
-- Seed Data
-- ============================================================

-- Default reservation timeout: 30 minutes
insert into settings (key, value)
values ('reservation_timeout_minutes', '30'::jsonb)
on conflict (key) do nothing;
