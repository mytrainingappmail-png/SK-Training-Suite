-- Fix: employees.first_name/last_name/email are varchar(100), not text.
-- Postgres requires an exact type match between a `returns table(...)`
-- declaration and the query's actual output columns — varchar(100) vs
-- text fails with 42804 ("structure of query does not match function
-- result type"), caught via live testing of get_platform_operator_admins.
-- Casting each column to text in the SELECT fixes both affected functions.

create or replace function get_platform_operator_admins()
returns table (id uuid, first_name text, last_name text, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operator_company_id uuid;
begin
  select c.id into v_operator_company_id from companies c where c.is_platform_operator = true limit 1;
  if v_operator_company_id is null then
    return;
  end if;

  return query
    select distinct e.id, e.first_name::text, e.last_name::text, e.email::text
    from employees e
    join employee_roles er on er.employee_id = e.id and er.active = true
    join roles r on r.id = er.role_id
    where e.company_id = v_operator_company_id
      and e.active = true
      and r.role_code in ('SUPER_ADMIN','ADMIN','HR');
end;
$$;

grant execute on function get_platform_operator_admins() to authenticated;

create or replace function get_platform_ticket_raiser(p_ticket_id uuid)
returns table (email text, first_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket support_tickets%rowtype;
begin
  if not current_company_is_platform_operator() then
    return;
  end if;

  select * into v_ticket from support_tickets where id = p_ticket_id and audience = 'platform';
  if v_ticket.id is null then
    return;
  end if;

  return query select e.email::text, e.first_name::text from employees e where e.id = v_ticket.employee_id;
end;
$$;

grant execute on function get_platform_ticket_raiser(uuid) to authenticated;

-- getAdminEmployeesForCompany's earlier queries (roles/employee_roles/employees
-- via plain .select()) never hit this because PostgREST doesn't enforce a
-- return-type contract on plain table selects — only on `returns table(...)`
-- RPCs — so no other function in this migration set needed the same fix.
