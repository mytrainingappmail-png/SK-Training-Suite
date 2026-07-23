-- "Forgot password?" has no real email-sending backend to work with yet
-- (this app can't send mail at all today), so instead of a fake button,
-- this notifies that company's admins (Super Admin / Admin / HR) directly
-- through the existing notification feed, so they can reset the password
-- from Employee Management. Runs pre-login (no session exists yet), same
-- SECURITY DEFINER pattern as the login lookup RPCs.

create or replace function request_password_reset(
  p_company_code text,
  p_employee_code text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_employee employees%rowtype;
  v_notification_id uuid;
  v_admin record;
begin
  select id into v_company_id from companies
  where lower(company_code) = lower(trim(p_company_code)) and active = true
  limit 1;

  if v_company_id is null then
    -- Same generic failure as a bad login — never reveal which part was wrong.
    return;
  end if;

  select * into v_employee from employees
  where company_id = v_company_id and lower(employee_code) = lower(trim(p_employee_code)) and active = true
  limit 1;

  if v_employee.id is null then
    return;
  end if;

  insert into notifications (
    company_id, type, title, message, priority, audience_type,
    channel_in_app, status, created_by_name
  ) values (
    v_company_id, 'password_reset',
    'Password reset requested',
    v_employee.first_name || ' ' || v_employee.last_name || ' (' || v_employee.employee_code || ') requested a password reset. Reset it from Employee Management.',
    'high', 'role', true, 'delivered', 'System'
  )
  returning id into v_notification_id;

  for v_admin in
    select distinct e.id as employee_id
    from employees e
    join employee_roles er on er.employee_id = e.id and er.active = true
    join roles r on r.id = er.role_id
    where e.company_id = v_company_id
      and e.active = true
      and r.role_code in ('SUPER_ADMIN', 'ADMIN', 'HR')
  loop
    insert into notification_recipients (notification_id, company_id, employee_id, delivery_status, sent_at)
    values (v_notification_id, v_company_id, v_admin.employee_id, 'delivered', now())
    on conflict (notification_id, employee_id) do nothing;
  end loop;
end;
$$;

grant execute on function request_password_reset(text, text) to anon, authenticated;
