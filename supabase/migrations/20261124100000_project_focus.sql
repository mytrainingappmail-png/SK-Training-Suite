-- Focused projects: every company marks which of its own projects are "focused" (the ones the team should push now). The rest
-- stay "other projects". Kept in its own small table (not a column on the project) so a company's own choice is never touched
-- when the owner sends or updates projects, and nothing about copies / updates changes. Everyone in the company can read it;
-- only a company admin can change it.

create table if not exists public.project_focus (
  project_id uuid primary key references public.real_estate_projects(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_focus_company on public.project_focus (company_id);

alter table public.project_focus enable row level security;

drop policy if exists project_focus_select on public.project_focus;
create policy project_focus_select on public.project_focus
  for select using (company_id = current_employee_company_id());

drop policy if exists project_focus_insert on public.project_focus;
create policy project_focus_insert on public.project_focus
  for insert with check (company_id = current_employee_company_id() and current_employee_is_company_admin());

drop policy if exists project_focus_delete on public.project_focus;
create policy project_focus_delete on public.project_focus
  for delete using (company_id = current_employee_company_id() and current_employee_is_company_admin());
