-- ============================================================================
-- SUPPORT TICKETS + EMAIL TEMPLATES
--
-- support_tickets / support_ticket_messages back a real employee-facing
-- "Raise a Ticket" page and an admin-facing Ticket Management screen.
-- RLS follows this app's established convention (company-scoped `for all`
-- policies — see notifications, companies, etc.): any authenticated
-- employee in the company can read/write rows for that company, and the
-- application layer decides who actually sees what (employees see only
-- their own tickets via a filtered query; admins see all). This mirrors
-- every other company-scoped table in this schema.
--
-- email_templates replaces the session-local-only state previously used
-- by src/components/admin/email/EmailTemplateBuilder.tsx so templates
-- actually persist and can be used to compile real outgoing email.
-- ============================================================================

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  subject text not null,
  description text not null default '',
  category text not null default 'general' check (category in ('technical','billing','content','account','general')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  assigned_to uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  author_employee_id uuid references employees(id) on delete set null,
  author_name text not null default '',
  is_admin_reply boolean not null default false,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null default 'Untitled Template',
  category text not null default 'general_announcement',
  subject text not null default '',
  body_html text not null default '',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  branding jsonb not null default '{}'::jsonb,
  created_by uuid references employees(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_company on support_tickets (company_id, created_at desc);
create index if not exists idx_support_tickets_employee on support_tickets (employee_id, created_at desc);
create index if not exists idx_support_ticket_messages_ticket on support_ticket_messages (ticket_id, created_at);
create index if not exists idx_email_templates_company on email_templates (company_id, created_at desc);

alter table support_tickets enable row level security;
create policy support_tickets_company_scoped on support_tickets
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter table support_ticket_messages enable row level security;
create policy support_ticket_messages_company_scoped on support_ticket_messages
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter table email_templates enable row level security;
create policy email_templates_company_scoped on email_templates
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

-- ============================================================================
-- PERMISSIONS — new codes + auto-grant to existing admin-tier roles
-- (mirrors src/database/seed.sql: SUPER_ADMIN receives every permission;
-- here we also extend that same grant to ADMIN/HR for the ticket-viewing
-- side, since that's the realistic support-desk audience, matching the
-- admin set already used by request_password_reset()).
-- ============================================================================

insert into permissions (permission_code, permission_name, module_name, description)
select 'view_support_ticket', 'View Support Tickets', 'Support', 'View support tickets raised by employees'
where not exists (select 1 from permissions where permission_code = 'view_support_ticket');

insert into permissions (permission_code, permission_name, module_name, description)
select 'create_support_ticket', 'Create Support Tickets', 'Support', 'Raise a new support ticket'
where not exists (select 1 from permissions where permission_code = 'create_support_ticket');

insert into permissions (permission_code, permission_name, module_name, description)
select 'edit_support_ticket', 'Edit Support Tickets', 'Support', 'Reply to and change status of support tickets'
where not exists (select 1 from permissions where permission_code = 'edit_support_ticket');

insert into permissions (permission_code, permission_name, module_name, description)
select 'delete_support_ticket', 'Delete Support Tickets', 'Support', 'Delete support tickets'
where not exists (select 1 from permissions where permission_code = 'delete_support_ticket');

insert into permissions (permission_code, permission_name, module_name, description)
select 'view_email_template', 'View Email Templates', 'Email Templates', 'View email templates'
where not exists (select 1 from permissions where permission_code = 'view_email_template');

insert into permissions (permission_code, permission_name, module_name, description)
select 'create_email_template', 'Create Email Templates', 'Email Templates', 'Create new email templates'
where not exists (select 1 from permissions where permission_code = 'create_email_template');

insert into permissions (permission_code, permission_name, module_name, description)
select 'edit_email_template', 'Edit Email Templates', 'Email Templates', 'Edit email templates'
where not exists (select 1 from permissions where permission_code = 'edit_email_template');

insert into permissions (permission_code, permission_name, module_name, description)
select 'delete_email_template', 'Delete Email Templates', 'Email Templates', 'Delete email templates'
where not exists (select 1 from permissions where permission_code = 'delete_email_template');

-- SUPER_ADMIN (every company) gets every new permission.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.role_code = 'SUPER_ADMIN'
  and p.permission_code in (
    'view_support_ticket','create_support_ticket','edit_support_ticket','delete_support_ticket',
    'view_email_template','create_email_template','edit_email_template','delete_email_template'
  )
  and not exists (
    select 1 from role_permissions rp where rp.role_id = r.id and rp.permission_id = p.id
  );

-- ADMIN / HR (every company) get view+create+edit for both (not delete —
-- matches the more conservative grant pattern used elsewhere for non-Super-Admin roles).
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.role_code in ('ADMIN','HR')
  and p.permission_code in (
    'view_support_ticket','create_support_ticket','edit_support_ticket',
    'view_email_template','create_email_template','edit_email_template'
  )
  and not exists (
    select 1 from role_permissions rp where rp.role_id = r.id and rp.permission_id = p.id
  );
