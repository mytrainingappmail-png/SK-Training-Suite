-- Generic per-company module/add-on toggle system.
--
-- Until now, "can this company use feature X" meant one new boolean column
-- on companies (market_analytics_enabled, live_quiz_enabled), hand-wired
-- into Sidebar.tsx/Admin.tsx one at a time. That doesn't scale: every new
-- feature or add-on needed a migration + a new column + new gating code in
-- several files, and there was no single screen listing what a company has
-- access to.
--
-- app_modules is a developer-managed registry of every toggleable section —
-- shipping a new feature is one INSERT here, nothing else. company_modules
-- is the platform operator's per-company override (customization at
-- onboarding/subscription time). current_company_module_enabled() resolves
-- the effective value: explicit override if one exists, else the module's
-- own default — so a brand-new module automatically applies to every
-- existing company the moment it's registered, with zero backfill.

create table if not exists app_modules (
  key text primary key,
  label text not null,
  description text not null default '',
  category text not null default 'Learning',
  is_addon boolean not null default false,
  default_enabled boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table app_modules enable row level security;

-- Labels/descriptions aren't sensitive, and every logged-in user's Sidebar
-- needs to read default_enabled to gate menu items.
drop policy if exists app_modules_read_all on app_modules;
create policy app_modules_read_all on app_modules
  for select using (true);

-- The registry itself is migration-managed in practice, but scope write
-- access to the platform operator rather than leaving it wide open.
drop policy if exists app_modules_write_operator on app_modules;
create policy app_modules_write_operator on app_modules
  for all using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create table if not exists company_modules (
  company_id uuid not null references companies(id) on delete cascade,
  module_key text not null references app_modules(key) on delete cascade,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (company_id, module_key)
);

alter table company_modules enable row level security;

-- A company's own employees can read their company's overrides (Sidebar
-- gating needs this); the platform operator can read every company's.
drop policy if exists company_modules_read on company_modules;
create policy company_modules_read on company_modules
  for select using (
    company_id = current_employee_company_id()
    or current_company_is_platform_operator()
  );

-- Only the platform operator customizes any company's module access —
-- this is the "subscription customization" screen the whole feature is for.
drop policy if exists company_modules_write_operator on company_modules;
create policy company_modules_write_operator on company_modules
  for all using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create or replace function current_company_module_enabled(p_company_id uuid, p_module_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select cm.enabled from company_modules cm where cm.company_id = p_company_id and cm.module_key = p_module_key),
    (select am.default_enabled from app_modules am where am.key = p_module_key),
    true
  );
$$;

-- ── Seed the registry with every current section/add-on ─────────────────
insert into app_modules (key, label, description, category, is_addon, default_enabled, display_order) values
  ('courses', 'Courses & Learning Content', 'Course catalog, modules, lessons, and resources.', 'Learning', false, true, 10),
  ('learning_paths', 'Learning Paths', 'Structured multi-course learning paths and enrollments.', 'Learning', false, true, 20),
  ('assessments', 'Assessments & Tests', 'Quizzes, assignments, evaluation rules, and results.', 'Learning', false, true, 30),
  ('certificates', 'Certificates', 'Certificate templates, generation, and verification.', 'Learning', false, true, 40),
  ('projects', 'Real Estate Project Management', 'Project sections, FAQs, and test authoring for real estate projects — switch off for companies outside real estate.', 'Industry', false, true, 50),
  ('brainstorming', 'Brainstorming', 'Fun quiz-game categories for employees.', 'Engagement', false, true, 60),
  ('attendance', 'Attendance & Geofencing', 'Employee attendance tracking and location geofencing.', 'Operations', false, true, 70),
  ('help_center', 'Help Center', 'Searchable help articles and the Help Bot widget.', 'Support', false, true, 80),
  ('support_tickets', 'Support Tickets', 'Employee ticket raising, ticket management, and email templates.', 'Support', false, true, 90),
  ('employee_of_the_month', 'Employee of the Month', 'Monthly recognition spotlight.', 'Engagement', false, true, 100),
  ('market_analytics', 'Market Analytics', 'PropAnalytics real-estate market data — paid add-on.', 'Add-ons', true, false, 110),
  ('live_quiz', 'Live Quiz', 'Kahoot-style live quiz hosting — paid add-on.', 'Add-ons', true, false, 120)
on conflict (key) do nothing;

-- ── Migrate the two existing ad-hoc flags so no company's current access changes ──
insert into company_modules (company_id, module_key, enabled)
select id, 'market_analytics', market_analytics_enabled from companies
on conflict (company_id, module_key) do nothing;

insert into company_modules (company_id, module_key, enabled)
select id, 'live_quiz', live_quiz_enabled from companies
on conflict (company_id, module_key) do nothing;
