-- Lets the platform operator send a real (not just in-app) reply email
-- directly to a platform ticket's raiser. Self-authorizing: only resolves
-- when the CALLER is the platform operator AND the ticket is
-- audience='platform' — never usable to look up an arbitrary employee.
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

  return query select e.email, e.first_name from employees e where e.id = v_ticket.employee_id;
end;
$$;

grant execute on function get_platform_ticket_raiser(uuid) to authenticated;
