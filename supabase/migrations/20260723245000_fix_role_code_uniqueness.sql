-- roles.role_code had a bare-global unique constraint (roles_role_code_key)
-- left over from when this schema had exactly one company — genuinely
-- incompatible with multi-tenancy, since every company legitimately needs
-- its own row with role_code = 'SUPER_ADMIN' (app logic throughout the
-- codebase checks this literal string, e.g. Sidebar.tsx's isSuperAdmin
-- check and several RPCs added this session). Replace it with the correct
-- per-company uniqueness.

alter table roles drop constraint if exists roles_role_code_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'roles_company_role_code_key'
  ) then
    alter table roles add constraint roles_company_role_code_key unique (company_id, role_code);
  end if;
end $$;
