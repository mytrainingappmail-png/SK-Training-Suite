-- src/components/admin/audit/AuditLogCenter.tsx already exists, is fully
-- real (derives entries from actual created_at/updated_at timestamps, no
-- fake data), and references PERMISSIONS.VIEW_AUDIT_LOG — but the
-- permission row itself was never seeded, and the component was never
-- wired into Admin.tsx. Same "built but orphaned" pattern already found
-- and fixed this session for Settings/Theme/Branding.

insert into permissions (permission_code, permission_name, module_name, description)
select 'view_audit_log', 'View Audit Log', 'Audit', 'View the activity/audit timeline'
where not exists (select 1 from permissions where permission_code = 'view_audit_log');

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.role_code = 'SUPER_ADMIN'
  and p.permission_code = 'view_audit_log'
  and not exists (select 1 from role_permissions rp where rp.role_id = r.id and rp.permission_id = p.id);

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.role_code in ('ADMIN', 'HR')
  and p.permission_code = 'view_audit_log'
  and not exists (select 1 from role_permissions rp where rp.role_id = r.id and rp.permission_id = p.id);
