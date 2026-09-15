-- Real server-side automation — the first in this app (confirmed: no
-- pg_cron/pg_net extension was ever enabled here; even the license-expiry
-- Edge Function shipped with only a manual "Check Now" button). Schedules
-- the license-notification-scheduler Edge Function (deployed separately
-- via `supabase functions deploy`) to run once a day, so expiry warnings
-- go out with zero human action — mirrors, server-side, exactly what
-- "Check Now" already does client-side, and is equally safe to run
-- repeatedly (license_notifications is still the dedup source of truth).
--
-- The service-role key the cron job needs to authenticate its HTTP call
-- is stored in Supabase Vault (already enabled on this project) via a
-- ONE-TIME `select vault.create_secret(...)` run directly against the
-- database — deliberately NOT in this file, so the actual key value
-- never lands in git history. This migration only references it by name.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select
  cron.schedule(
    'license-notification-daily-check',
    '30 3 * * *', -- 03:30 UTC = 09:00 IST — once daily, before business hours
    $$
    select net.http_post(
      url := 'https://psxbxbbspkteiczojajh.supabase.co/functions/v1/license-notification-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'license_scheduler_service_role_key')
      ),
      body := '{}'::jsonb
    );
    $$
  )
where not exists (select 1 from cron.job where jobname = 'license-notification-daily-check');
