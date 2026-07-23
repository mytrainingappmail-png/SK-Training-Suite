-- Support Tickets and Help Center are being repositioned as admin-facing
-- (a subscribed company's own Admin/Super Admin/HR uses these to get
-- "educated" on the platform and to escalate to the platform operator),
-- not employee self-service. Employees no longer see either in their
-- sidebar or can reach the routes directly.
--
-- view_support_ticket already exists (20260723160000) and is already
-- correctly scoped to SUPER_ADMIN/ADMIN/HR only — nothing to change there.
-- Help Center had no permission gate at all (read-open to every
-- authenticated user); this adds one, seeded the same way.

insert into permissions (permission_code, permission_name, module_name, description)
select 'view_help_center', 'View Help Center', 'Help Center', 'View the in-app Help Center'
where not exists (select 1 from permissions where permission_code = 'view_help_center');

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.role_code in ('SUPER_ADMIN', 'ADMIN', 'HR')
  and p.permission_code = 'view_help_center'
  and not exists (
    select 1 from role_permissions rp where rp.role_id = r.id and rp.permission_id = p.id
  );
