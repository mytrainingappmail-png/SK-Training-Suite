-- Projects were previously just a name/description/thumbnail/brochures —
-- purely browsable reference material with no way to verify an employee
-- actually went through it. This adds structured "Sections" inside each
-- project: a Subject Line (title) plus a type -
--   'page' - rich text content (reuses the same RichTextEditor already
--             used for the project's own Full Description)
--   'test' - links to a REAL row in the existing assessments table, so it
--             reuses the entire existing question bank / evaluation rule /
--             AssessmentPlayer / assessment_results pipeline untouched -
--             a project test's score is a normal assessment result, so it
--             already shows up in Results/Reports with no extra plumbing.
--   'faq'  - a simple question/answer list (jsonb array)

create table if not exists real_estate_project_sections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references real_estate_projects(id) on delete cascade,
  section_type text not null check (section_type in ('page', 'test', 'faq')),
  title text not null default '',
  display_order int not null default 0,
  page_content text not null default '',
  assessment_id uuid references assessments(id) on delete set null,
  faq_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_real_estate_project_sections_project
  on real_estate_project_sections (project_id, display_order);

alter table real_estate_project_sections enable row level security;
create policy real_estate_project_sections_company_scoped on real_estate_project_sections
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());
