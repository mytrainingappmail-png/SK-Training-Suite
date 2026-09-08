-- Induction — a simple, standalone day-by-day onboarding program for new
-- employees. Deliberately modeled 1:1 on real_estate_projects /
-- real_estate_project_sections (flat, no categories, no learning-path
-- machinery): a Day is like a Project, and each Day has Page/Test
-- sections exactly like a Project's sections -- "Test" sections reuse the
-- existing Assessment system, same as a Project's test section already
-- does, so no new quiz engine is needed.
--
-- induction_assignments is the simple per-employee grant that drives
-- both the employee-facing "Induction" sidebar item and the "other tabs
-- disabled while in induction" behavior -- same shape as the Calling App
-- admin-grant pattern (a row = access), not a full enrollment/learning-
-- path model.

create table induction_days (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  description text,
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table induction_day_sections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  day_id uuid not null references induction_days(id) on delete cascade,
  section_type text not null default 'page' check (section_type in ('page', 'test')),
  title text not null,
  display_order int not null default 0,
  page_content text,
  assessment_id uuid references assessments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table induction_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (employee_id)
);

create index idx_induction_days_company on induction_days(company_id, display_order);
create index idx_induction_day_sections_day on induction_day_sections(day_id, display_order);
create index idx_induction_assignments_employee on induction_assignments(employee_id);

alter table induction_days enable row level security;
alter table induction_day_sections enable row level security;
alter table induction_assignments enable row level security;

-- Same convention as every other company-content table in this app:
-- the RLS boundary is the tenant (company_id), not the role -- which
-- screens can write is a frontend/menu concern (admin-only routes),
-- exactly like real_estate_projects already works.
create policy induction_days_company_scoped on induction_days
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

create policy induction_day_sections_company_scoped on induction_day_sections
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

create policy induction_assignments_company_scoped on induction_assignments
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());
