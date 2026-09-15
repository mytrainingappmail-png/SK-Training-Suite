-- Performance Tracker auto-reminders — no server-side cron exists
-- anywhere in this app yet (confirmed: even license-expiry notices are a
-- manual "Check Now" button), so this runs client-side instead: whenever
-- ANYONE with access opens Performance Tracker, the app checks whether
-- today's reminder pass (per company, per kind) has already happened. If
-- not, and the configured cutoff time has passed, it fires once — this
-- row is the "already ran today" claim that keeps it from firing twice,
-- including from two people opening the tracker around the same moment.

alter table pt_settings
  add column auto_reminder_enabled boolean not null default false,
  add column auto_reminder_morning_cutoff time not null default '11:00:00',
  add column auto_reminder_evening_cutoff time not null default '19:00:00';

create table pt_auto_reminder_runs (
  company_id uuid not null references companies(id) on delete cascade,
  kind text not null check (kind in ('morning', 'evening')),
  run_date date not null,
  ran_at timestamptz not null default now(),
  primary key (company_id, kind, run_date)
);

alter table pt_auto_reminder_runs enable row level security;

create policy pt_auto_reminder_runs_company_scoped on pt_auto_reminder_runs
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());
