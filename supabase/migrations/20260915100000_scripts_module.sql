-- Scripts — a separate, standalone content section (its own sidebar item,
-- not nested under Projects) where an admin writes editable, Word-style
-- sales scripts (rich text, no PDF upload) that any employee can search,
-- read, and download as a PDF. Deliberately flat, no categories — mirrors
-- real_estate_projects' own "just a company-scoped content table" shape.
--
-- watermark_enabled/watermark_text: an optional per-script brand watermark,
-- shown on-screen and baked into the downloaded PDF. Only the platform
-- operator's own account can ever see the toggle (frontend gate, same
-- ad-hoc is_platform_operator check used by Market Analytics/Live Quiz) —
-- so a client's own scripts never carry it, but IKB's content keeps IKB's
-- brand even after Content Distribution clones it into a client company
-- (the boolean/text columns copy verbatim, same as every other field).

create table scripts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  content text not null default '',
  watermark_enabled boolean not null default false,
  watermark_text text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_scripts_company on scripts(company_id, title);

alter table scripts enable row level security;

-- Same convention as every other company-content table in this app: the
-- RLS boundary is the tenant (company_id), not the role -- which screens
-- can write is a frontend/menu concern (admin-only "Add Script" button),
-- exactly like real_estate_projects/induction_days already work.
create policy scripts_company_scoped on scripts
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());
