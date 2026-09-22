-- A small personal library so a company admin can keep several logo files (different sizes,
-- formats, an old version they might want back) and re-apply any of them to Company Logo /
-- Login Logo / App Icon / Favicon without re-uploading each time. Same "course-content" bucket
-- everything else already uses — this table is just an organized index over that company's own
-- uploads, not a new storage location.

create table if not exists company_logo_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  url text not null,
  label text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_company_logo_assets_company on company_logo_assets (company_id, created_at desc);

alter table company_logo_assets enable row level security;

drop policy if exists company_logo_assets_own on company_logo_assets;
create policy company_logo_assets_own on company_logo_assets
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

-- The platform operator manages any company's branding too (Admin -> Company Management can be
-- reached for another company in some flows) — same read/write reach as companies_update_platform_operator.
drop policy if exists company_logo_assets_platform_operator on company_logo_assets;
create policy company_logo_assets_platform_operator on company_logo_assets
  for all using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());
