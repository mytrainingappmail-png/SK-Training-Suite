-- Undo 20261125100000_company_backups.sql (stored backup FILES in the 'company-backups' bucket are not deleted by this).
select cron.unschedule('company-weekly-backup') where exists (select 1 from cron.job where jobname = 'company-weekly-backup');
drop policy if exists company_backups_upload on storage.objects;
drop function if exists public.restore_company_data(uuid, jsonb, boolean);
drop function if exists public.backup_company_data(uuid);
drop function if exists public._backup_scope(uuid);
drop function if exists public._backup_no_restore_tables();
drop function if exists public._backup_skip_tables();
drop table if exists public.company_backup_settings;
drop table if exists public.company_backups;
