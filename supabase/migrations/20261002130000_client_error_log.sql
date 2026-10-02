-- A private log of "Something went wrong" screens that customers hit, for the platform owner.
--
-- Until now an error on a customer's screen was invisible: the customer said "it broke" and there
-- was nothing to look at. The app now sends a short record (what failed, on which page, which
-- company/employee) through report_client_error(); only the platform owner can read the list.
--
--   * the company and employee are taken from the signed-in session, never from what the browser says
--   * at most 20 records per employee per hour, text is length-limited (no flooding, no huge rows)
--   * nothing here can be written directly: the table has no insert policy, only the function

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  company_id uuid references public.companies(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  message text not null,
  stack text,
  page text,
  user_agent text
);

create index if not exists client_errors_at_idx on public.client_errors (at desc);
create index if not exists client_errors_company_idx on public.client_errors (company_id, at desc);

alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;
grant select, delete on public.client_errors to authenticated;

drop policy if exists client_errors_platform_operator_read on public.client_errors;
create policy client_errors_platform_operator_read on public.client_errors
  for select to authenticated using (public.current_company_is_platform_operator());

drop policy if exists client_errors_platform_operator_delete on public.client_errors;
create policy client_errors_platform_operator_delete on public.client_errors
  for delete to authenticated using (public.current_company_is_platform_operator());

create or replace function public.report_client_error(p_message text, p_stack text default null, p_page text default null, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee uuid;
  v_company uuid;
begin
  select e.id, e.company_id into v_employee, v_company
  from employees e where e.auth_user_id = auth.uid() limit 1;
  if v_employee is null then
    return; -- not a signed-in employee: nothing to attribute it to
  end if;

  if (select count(*) from client_errors where employee_id = v_employee and at > now() - interval '1 hour') >= 20 then
    return; -- a broken screen can fire repeatedly; keep the first few
  end if;

  insert into client_errors (company_id, employee_id, message, stack, page, user_agent)
  values (
    v_company, v_employee,
    left(coalesce(nullif(trim(p_message), ''), 'Unknown error'), 500),
    left(p_stack, 4000), left(p_page, 300), left(p_user_agent, 300)
  );
end;
$$;

revoke all on function public.report_client_error(text, text, text, text) from public, anon;
grant execute on function public.report_client_error(text, text, text, text) to authenticated;
