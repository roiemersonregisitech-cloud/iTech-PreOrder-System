-- ============================================================
-- pg_cron Job for Auto-Expiring Reservations
-- Run every 1 minute
-- ============================================================
-- NOTE: pg_cron must be enabled in your Supabase project.
-- Go to Database → Extensions → Enable pg_cron

-- Enable the pg_cron extension
create extension if not exists pg_cron;

-- Schedule the job
select cron.schedule(
  'release-expired-reservations',
  '* * * * *',
  'select release_expired_reservations();'
);

