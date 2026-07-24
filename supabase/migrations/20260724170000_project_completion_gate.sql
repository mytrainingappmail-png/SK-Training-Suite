-- Tracks that an employee marked a project as "read/complete" - used to
-- gate any Test sections on that project so the test only becomes
-- available (and mandatory) after the employee confirms they've gone
-- through the project material first, not available from the very start.

create table if not exists real_estate_project_progress (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references real_estate_projects(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (project_id, employee_id)
);

create index if not exists idx_real_estate_project_progress_lookup on real_estate_project_progress (project_id, employee_id);

alter table real_estate_project_progress enable row level security;
create policy real_estate_project_progress_company_scoped on real_estate_project_progress
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());
