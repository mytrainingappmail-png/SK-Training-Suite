-- AI Practice: employees practise real customer situations (price objection, "I will think about it", …) by typing or
-- speaking an answer; the platform's AI scores it against criteria the admin defines and shows a better sample answer.
--
--  practice_settings   one row per company: on/off switch and attempts per person per day (default off).
--  practice_scenarios  what the customer says + the scoring points — written by the admin, nothing hardcoded.
--  practice_attempts   every answer with its score and feedback. Written ONLY by the practice-evaluate edge function,
--                      so a score can never be typed in by hand.

create table if not exists practice_settings (
  company_id uuid primary key references companies(id) on delete cascade,
  enabled boolean not null default false,
  daily_limit int not null default 10 check (daily_limit between 1 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists practice_scenarios (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  customer_says text not null,
  context text not null default '',
  -- [{ "name": "Builds value before price", "hint": "…" }, …] — what the AI scores the answer on
  criteria jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  display_order int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_practice_scenarios_company on practice_scenarios (company_id, display_order);

create table if not exists practice_attempts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  scenario_id uuid not null references practice_scenarios(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  answer_text text not null,
  spoken boolean not null default false,
  -- [{ "name": "…", "score": 0-10, "comment": "…" }, …]
  scores jsonb not null default '[]'::jsonb,
  total_score int not null default 0 check (total_score between 0 and 100),
  feedback text not null default '',
  better_answer text not null default '',
  next_step text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_practice_attempts_employee on practice_attempts (employee_id, created_at desc);
create index if not exists idx_practice_attempts_scenario on practice_attempts (scenario_id, created_at desc);
create index if not exists idx_practice_attempts_company on practice_attempts (company_id, created_at desc);

alter table practice_settings enable row level security;
alter table practice_scenarios enable row level security;
alter table practice_attempts enable row level security;

-- settings: everyone in the company can see whether practice is on; only a company admin changes it
drop policy if exists practice_settings_read on practice_settings;
create policy practice_settings_read on practice_settings for select using (company_id = current_employee_company_id());
drop policy if exists practice_settings_admin_write on practice_settings;
create policy practice_settings_admin_write on practice_settings for all
  using (company_id = current_employee_company_id() and current_employee_is_company_admin())
  with check (company_id = current_employee_company_id() and current_employee_is_company_admin());

-- scenarios: employees see the active ones of their company; admins see and manage all
drop policy if exists practice_scenarios_read on practice_scenarios;
create policy practice_scenarios_read on practice_scenarios for select
  using (company_id = current_employee_company_id() and (active or current_employee_is_company_admin()));
drop policy if exists practice_scenarios_admin_write on practice_scenarios;
create policy practice_scenarios_admin_write on practice_scenarios for all
  using (company_id = current_employee_company_id() and current_employee_is_company_admin())
  with check (company_id = current_employee_company_id() and current_employee_is_company_admin());

-- attempts: a person reads their own; a company admin reads everyone's in the company. Nobody writes from the browser.
drop policy if exists practice_attempts_read on practice_attempts;
create policy practice_attempts_read on practice_attempts for select
  using (
    company_id = current_employee_company_id()
    and (
      current_employee_is_company_admin()
      or employee_id = (select e.id from employees e where e.auth_user_id = auth.uid() limit 1)
    )
  );
drop policy if exists practice_attempts_admin_delete on practice_attempts;
create policy practice_attempts_admin_delete on practice_attempts for delete
  using (company_id = current_employee_company_id() and current_employee_is_company_admin());
