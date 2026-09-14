-- Performance Tracker — a daily sales-activity commitment & scoring
-- tracker (Morning Commitment -> Evening Report -> auto-scored -> trends /
-- leaderboard / team analytics), ported from the reference IKB HRMS build
-- and adapted to this app's own conventions:
--   * RLS is company-scoped only (company_id = current_employee_company_id())
--     for every command, same as every other content table here (Induction,
--     Real Estate Projects) — who gets to see/write what is a frontend/menu
--     concern, not a DB-layer role check.
--   * Gated as a premium add-on through the EXISTING app_modules registry
--     (one seed row below) instead of inventing a new companies.*_enabled
--     column or a separate billing schema — this is exactly what that
--     registry was built for ("shipping a new feature is one INSERT here").
--   * Dropped the reference app's Salesforce-specific "_in_salesforce"
--     checkboxes (no CRM integration here) and its pg_cron/WhatsApp/email
--     auto-reminder infrastructure (this project has no Edge
--     Function/cron setup yet) — the manual "Send Reminder" button still
--     works, using this app's own notifications table.
-- Safe to run once; every statement is idempotent.

-- ---------- Sales teams (independent of Department) ----------
create table if not exists pt_teams (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  team_leader_employee_id uuid references employees(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

alter table employees add column if not exists pt_team_id uuid references pt_teams(id) on delete set null;

-- ---------- Per-company config (min criteria / scoring weights / leaderboard formula) ----------
create table if not exists pt_settings (
  company_id uuid primary key references companies(id) on delete cascade,
  min_f2f int not null default 2,
  min_sv int not null default 1,
  min_revisit int not null default 1,
  min_calls int not null default 100,
  min_conn int not null default 25,
  min_talk int not null default 120,
  score_f2f numeric not null default 10,
  score_sv numeric not null default 20,
  score_revisit numeric not null default 15,
  score_booking numeric not null default 100,
  score_conn numeric not null default 2,
  score_talk_per5 numeric not null default 1,
  leaderboard_formula text not null default 'achievement'
    check (leaderboard_formula in ('achievement','score','bookings','composite')),
  updated_at timestamptz not null default now()
);

-- ---------- Admin-defined custom KPI fields (no hardcoded metric list) ----------
create table if not exists pt_custom_fields (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  field_key text not null,
  label text not null,
  applies_morning boolean not null default true,
  applies_evening boolean not null default true,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, field_key)
);

-- ---------- Morning commitment ----------
create table if not exists pt_commitments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  work_date date not null,
  f2f_planned int not null default 0,
  sv_planned int not null default 0,
  revisit_planned int not null default 0,
  calls_planned int not null default 0,
  conn_target int not null default 0,
  talk_target int not null default 0,
  remarks text,
  custom_values jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create index if not exists idx_pt_commitments_company_date on pt_commitments(company_id, work_date);

-- ---------- Evening report ----------
create table if not exists pt_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  work_date date not null,
  f2f_done int not null default 0,
  sv_done int not null default 0,
  revisit_done int not null default 0,
  calls_done int not null default 0,
  conn_done int not null default 0,
  talk_done int not null default 0,
  leads int not null default 0,
  meetings_fixed int not null default 0,
  bookings int not null default 0,
  remarks text,
  custom_values jsonb not null default '{}'::jsonb,
  -- Computed server-side by the trigger below — never trust a client value.
  score numeric,
  achievement_pct numeric,
  min_criteria_met boolean,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create index if not exists idx_pt_reports_company_date on pt_reports(company_id, work_date);

-- ---------- Champion categories (admin-editable labels, not hardcoded) ----------
create table if not exists pt_champion_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  metric_key text not null check (metric_key in ('f2f','sv','bookings','achievement','calls','talk')),
  label text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  unique (company_id, metric_key)
);

-- ---------- RLS: company-scoped only, matching every other content table ----------
alter table pt_teams enable row level security;
alter table pt_settings enable row level security;
alter table pt_custom_fields enable row level security;
alter table pt_commitments enable row level security;
alter table pt_reports enable row level security;
alter table pt_champion_categories enable row level security;

create policy pt_teams_company_scoped on pt_teams
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

create policy pt_settings_company_scoped on pt_settings
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

create policy pt_custom_fields_company_scoped on pt_custom_fields
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

create policy pt_commitments_company_scoped on pt_commitments
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

create policy pt_reports_company_scoped on pt_reports
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

create policy pt_champion_categories_company_scoped on pt_champion_categories
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

-- ---------- Server-side scoring (never trust a client-sent score) ----------
-- Achievement% is "actual vs what THIS employee planned that morning", not
-- a hardcoded global target — a metric only counts toward the average if
-- something was actually planned for it, and each metric's contribution is
-- capped at 150% so one wildly-over metric can't mask a completely missed
-- one.
create or replace function pt_reports_compute_score() returns trigger
language plpgsql security definer
as $$
declare
  v_settings pt_settings%rowtype;
  v_commit pt_commitments%rowtype;
  v_sum numeric := 0;
  v_n int := 0;
begin
  select * into v_settings from pt_settings where company_id = new.company_id;
  if not found then
    insert into pt_settings (company_id) values (new.company_id)
    on conflict (company_id) do nothing;
    select * into v_settings from pt_settings where company_id = new.company_id;
  end if;

  new.score :=
      new.f2f_done * v_settings.score_f2f
    + new.sv_done * v_settings.score_sv
    + new.revisit_done * v_settings.score_revisit
    + new.bookings * v_settings.score_booking
    + new.conn_done * v_settings.score_conn
    + floor(new.talk_done / 5.0) * v_settings.score_talk_per5;

  select * into v_commit from pt_commitments where employee_id = new.employee_id and work_date = new.work_date;

  if found then
    if v_commit.f2f_planned > 0 then
      v_sum := v_sum + least((new.f2f_done::numeric / v_commit.f2f_planned) * 100, 150);
      v_n := v_n + 1;
    end if;
    if v_commit.sv_planned > 0 then
      v_sum := v_sum + least((new.sv_done::numeric / v_commit.sv_planned) * 100, 150);
      v_n := v_n + 1;
    end if;
    if v_commit.calls_planned > 0 then
      v_sum := v_sum + least((new.calls_done::numeric / v_commit.calls_planned) * 100, 150);
      v_n := v_n + 1;
    end if;
  end if;

  new.achievement_pct := case when v_n > 0 then round(v_sum / v_n, 1) else null end;

  new.min_criteria_met := (
    new.f2f_done >= v_settings.min_f2f
    and new.sv_done >= v_settings.min_sv
    and new.revisit_done >= v_settings.min_revisit
    and new.calls_done >= v_settings.min_calls
    and new.conn_done >= v_settings.min_conn
    and new.talk_done >= v_settings.min_talk
  );

  new.submitted_at := coalesce(new.submitted_at, now());
  return new;
end;
$$;

drop trigger if exists trg_pt_reports_compute_score on pt_reports;
create trigger trg_pt_reports_compute_score
  before insert or update on pt_reports
  for each row execute function pt_reports_compute_score();

-- ---------- Register as a premium add-on in the existing module registry ----------
insert into app_modules (key, label, description, category, is_addon, default_enabled, display_order)
values (
  'performance_tracker', 'Performance Tracker',
  'Daily sales-activity commitment & scoring tracker — Morning Commitment, Evening Report, auto-scoring, leaderboard, team analytics, and alerts.',
  'Add-ons', true, false, 130
)
on conflict (key) do nothing;

notify pgrst, 'reload schema';

-- =========================================================
-- Verify with:
--   select column_name from information_schema.columns where table_name = 'pt_reports';
--   select proname from pg_proc where proname = 'pt_reports_compute_score';
--   select key, default_enabled from app_modules where key = 'performance_tracker';
--
-- To enable for a company (until the operator toggles it in Company
-- Management's Paid Add-ons grid), replace the UUID:
--   insert into company_modules (company_id, module_key, enabled)
--   values ('YOUR-COMPANY-UUID', 'performance_tracker', true)
--   on conflict (company_id, module_key) do update set enabled = true, updated_at = now();
-- =========================================================
