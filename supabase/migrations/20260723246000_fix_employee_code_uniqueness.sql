-- employees.employee_code had the same bare-global unique constraint flaw
-- as roles.role_code (see 20260723245000) — every company needs to be able
-- to use its own employee numbering (e.g. starting at "00001") without
-- colliding with any other company's employees. login_lookup_employee()
-- already scopes lookups by (company_id, employee_code) together, so this
-- was never actually needed for login correctness — just a legacy
-- single-tenant constraint that blocks real multi-tenancy.

alter table employees drop constraint if exists employees_employee_code_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'employees_company_employee_code_key'
  ) then
    alter table employees add constraint employees_company_employee_code_key unique (company_id, employee_code);
  end if;
end $$;
