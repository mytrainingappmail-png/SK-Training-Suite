-- Calling App (premium add-on) — Phase 1: dialing sheet + disposition
-- tracking + performance dashboard/reports + settings. Ported from a
-- more mature version already proven in a sibling HRMS project, scaled
-- down for Phase 1 (no Prospects/handoff, no break tracking, no
-- delegated team/company report scope yet — those are Phase 2).
--
-- Genuinely separate schema/identity, own database rows — nothing here
-- touches employees/companies beyond a company_id FK, mirroring the
-- Live Quiz / Aptitude Test pattern already established in this app.
--
-- Dual login design (both are the SAME calling_app_admins row, just
-- optionally linked to a real employee):
--   - employee_id set   -> this person can reach the Calling App from
--     their OWN existing LMS session (a Sidebar link, gated by this
--     row existing) — no second password to remember.
--   - auth_user_id set  -> a genuinely separate Supabase Auth login
--     (its own internal email, own session, own storage key), for
--     people who should only ever touch the Calling App (e.g.
--     outsourced telecallers who aren't real LMS employees at all).
--   Both may be set at once (an employee who's ALSO been given a
--   dedicated calling-only credential) — nothing requires them to be
--   exclusive.

insert into app_modules (key, label, description, category, is_addon, default_enabled, display_order) values
  ('calling_app', 'Calling App', 'Telecaller dialing sheet, disposition tracking, and performance dashboard — paid add-on.', 'Add-ons', true, false, 130)
on conflict (key) do nothing;

create table calling_app_admins (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  -- Either or both of these may be set — see header comment.
  employee_id uuid references employees(id) on delete set null,
  auth_user_id uuid unique,
  username text,
  display_name text not null,
  email text,
  is_admin boolean not null default false,
  can_upload boolean not null default true,
  can_download boolean not null default true,
  daily_target int not null default 0,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  unique (company_id, username),
  unique (company_id, employee_id),
  constraint calling_app_admins_needs_an_identity check (employee_id is not null or auth_user_id is not null or username is not null)
);

create table calling_app_dispositions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  label text not null,
  color text not null default '#64748b',
  outcome_type text not null default 'neutral' check (outcome_type in ('positive', 'neutral', 'negative')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table calling_app_custom_field_defs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type text not null default 'text' check (field_type in ('text', 'number', 'date', 'dropdown')),
  dropdown_options text[],
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, field_key)
);

create table calling_app_call_lists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  row_count int not null default 0,
  uploaded_by uuid references calling_app_admins(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create table calling_app_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  list_id uuid references calling_app_call_lists(id) on delete set null,
  name text not null,
  mobile_no text not null,
  email text,
  project_name text,
  assigned_to uuid references calling_app_admins(id) on delete set null,
  disposition_id uuid references calling_app_dispositions(id) on delete set null,
  remarks text,
  attempt_count int not null default 0,
  next_call_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_calling_app_contacts_company on calling_app_contacts(company_id);
create index idx_calling_app_contacts_assigned on calling_app_contacts(assigned_to);

create table calling_app_custom_field_values (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references calling_app_contacts(id) on delete cascade,
  field_def_id uuid not null references calling_app_custom_field_defs(id) on delete cascade,
  value_text text,
  unique (contact_id, field_def_id)
);

create table calling_app_call_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid not null references calling_app_contacts(id) on delete cascade,
  admin_id uuid not null references calling_app_admins(id) on delete cascade,
  disposition_id uuid references calling_app_dispositions(id) on delete set null,
  remarks text,
  called_at timestamptz not null default now()
);

create index idx_calling_app_call_logs_contact on calling_app_call_logs(contact_id);
create index idx_calling_app_call_logs_admin on calling_app_call_logs(admin_id, called_at);

-- ── Identity-resolution helpers ──────────────────────────────────────────
-- Resolves the CALLER'S row via either possible identity path: their own
-- calling_app_admins.auth_user_id (dedicated login), OR — for someone
-- using their normal LMS session — via employees.auth_user_id = auth.uid()
-- joined through calling_app_admins.employee_id.

create or replace function current_calling_app_admin_id() returns uuid
language sql stable security definer set search_path = public
as $$
  select ca.id from calling_app_admins ca
  where ca.status = 'active'
    and (
      ca.auth_user_id = auth.uid()
      or ca.employee_id = (select e.id from employees e where e.auth_user_id = auth.uid())
    )
  limit 1;
$$;

create or replace function current_calling_app_company_id() returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from calling_app_admins where id = current_calling_app_admin_id();
$$;

create or replace function current_calling_app_is_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_admin from calling_app_admins where id = current_calling_app_admin_id()), false);
$$;

create or replace function current_calling_app_can_upload() returns boolean
language sql stable security definer set search_path = public
as $$
  select current_calling_app_is_admin() or coalesce((select can_upload from calling_app_admins where id = current_calling_app_admin_id()), false);
$$;

create or replace function current_calling_app_can_download() returns boolean
language sql stable security definer set search_path = public
as $$
  select current_calling_app_is_admin() or coalesce((select can_download from calling_app_admins where id = current_calling_app_admin_id()), false);
$$;

-- ── RLS ───────────────────────────────────────────────────────────────

alter table calling_app_admins enable row level security;
alter table calling_app_dispositions enable row level security;
alter table calling_app_custom_field_defs enable row level security;
alter table calling_app_call_lists enable row level security;
alter table calling_app_contacts enable row level security;
alter table calling_app_custom_field_values enable row level security;
alter table calling_app_call_logs enable row level security;

create policy calling_app_admins_select on calling_app_admins for select
  using (company_id = current_calling_app_company_id() and current_calling_app_admin_id() is not null);

-- Granting/revoking Calling App access is a security boundary only a real
-- LMS employee session can cross (mirrors the aptitude/quiz provisioning
-- pattern) — never the Calling App's own session, even an admin one.
create policy calling_app_admins_write_employee on calling_app_admins for all
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

create policy calling_app_dispositions_select on calling_app_dispositions for select
  using (company_id = current_calling_app_company_id());
create policy calling_app_dispositions_write on calling_app_dispositions for all
  using (company_id = current_calling_app_company_id() and current_calling_app_is_admin())
  with check (company_id = current_calling_app_company_id() and current_calling_app_is_admin());

create policy calling_app_custom_field_defs_select on calling_app_custom_field_defs for select
  using (company_id = current_calling_app_company_id());
create policy calling_app_custom_field_defs_write on calling_app_custom_field_defs for all
  using (company_id = current_calling_app_company_id() and current_calling_app_is_admin())
  with check (company_id = current_calling_app_company_id() and current_calling_app_is_admin());

create policy calling_app_call_lists_select on calling_app_call_lists for select
  using (company_id = current_calling_app_company_id());
create policy calling_app_call_lists_write on calling_app_call_lists for all
  using (company_id = current_calling_app_company_id() and current_calling_app_can_upload())
  with check (company_id = current_calling_app_company_id() and current_calling_app_can_upload());

-- An agent only sees their OWN assigned contacts; an admin sees everyone's.
create policy calling_app_contacts_select on calling_app_contacts for select
  using (company_id = current_calling_app_company_id() and (current_calling_app_is_admin() or assigned_to = current_calling_app_admin_id()));
create policy calling_app_contacts_insert on calling_app_contacts for insert
  with check (company_id = current_calling_app_company_id() and (current_calling_app_is_admin() or current_calling_app_can_upload()));
create policy calling_app_contacts_update on calling_app_contacts for update
  using (company_id = current_calling_app_company_id() and (current_calling_app_is_admin() or assigned_to = current_calling_app_admin_id()))
  with check (company_id = current_calling_app_company_id() and (current_calling_app_is_admin() or assigned_to = current_calling_app_admin_id()));
create policy calling_app_contacts_delete on calling_app_contacts for delete
  using (company_id = current_calling_app_company_id() and current_calling_app_is_admin());

create policy calling_app_custom_field_values_select on calling_app_custom_field_values for select
  using (exists (select 1 from calling_app_contacts c where c.id = calling_app_custom_field_values.contact_id and c.company_id = current_calling_app_company_id() and (current_calling_app_is_admin() or c.assigned_to = current_calling_app_admin_id())));
create policy calling_app_custom_field_values_write on calling_app_custom_field_values for all
  using (exists (select 1 from calling_app_contacts c where c.id = calling_app_custom_field_values.contact_id and c.company_id = current_calling_app_company_id() and (current_calling_app_is_admin() or c.assigned_to = current_calling_app_admin_id())))
  with check (exists (select 1 from calling_app_contacts c where c.id = calling_app_custom_field_values.contact_id and c.company_id = current_calling_app_company_id() and (current_calling_app_is_admin() or c.assigned_to = current_calling_app_admin_id())));

create policy calling_app_call_logs_select on calling_app_call_logs for select
  using (company_id = current_calling_app_company_id() and (current_calling_app_is_admin() or admin_id = current_calling_app_admin_id()));
create policy calling_app_call_logs_insert on calling_app_call_logs for insert
  with check (company_id = current_calling_app_company_id() and admin_id = current_calling_app_admin_id());

-- Resolves a username to its company_code for the standalone Calling App
-- login screen (dedicated-login mode only) — same pre-auth lookup pattern
-- as get_quiz_admin_login_info / get_aptitude_admin_login_info.
create or replace function get_calling_app_admin_login_info(p_username text)
returns table (company_code text, module_enabled boolean)
language sql stable security definer set search_path = public
as $$
  select c.company_code, current_company_module_enabled(c.id, 'calling_app')
  from calling_app_admins ca
  join companies c on c.id = ca.company_id
  where lower(ca.username) = lower(p_username) and ca.status = 'active'
  limit 1;
$$;

grant execute on function get_calling_app_admin_login_info(text) to anon, authenticated;
