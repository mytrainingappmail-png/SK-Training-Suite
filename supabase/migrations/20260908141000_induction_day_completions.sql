-- Per-employee "I've gone through this Day" marker -- mirrors
-- real_estate_project_progress exactly (mark-complete unlocks that Day's
-- Test section, same UX as a Project). The one thing Induction needs
-- that Projects don't: Days are sequential, so the employee-facing page
-- also uses this table to lock Day N+1 until Day N (by display_order)
-- has a completion row.
create table induction_day_completions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  day_id uuid not null references induction_days(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (employee_id, day_id)
);

create index idx_induction_day_completions_employee on induction_day_completions(employee_id);

alter table induction_day_completions enable row level security;

create policy induction_day_completions_company_scoped on induction_day_completions
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());
