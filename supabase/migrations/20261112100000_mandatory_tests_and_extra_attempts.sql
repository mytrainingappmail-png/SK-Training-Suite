-- Mandatory tests + extra attempts.
--
-- 1) assessments.must_pass: the admin switches it on per test ("employees must pass this test"). Off by default, so
--    nothing changes for any existing test. Induction, Project and Course tests all are rows of `assessments`.
-- 2) assessment_attempt_grants: when somebody has used all attempts and failed, a company admin can give that person
--    extra attempts on that test. The player adds them to the test's own attempt limit.
--    Everybody in the company can READ the grants (the player needs its own); only a company admin can write them.

alter table assessments add column if not exists must_pass boolean not null default false;

create table if not exists assessment_attempt_grants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  extra_attempts integer not null default 0 check (extra_attempts >= 0 and extra_attempts <= 100),
  granted_by uuid references employees(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (assessment_id, employee_id)
);

create index if not exists idx_attempt_grants_employee on assessment_attempt_grants (employee_id);
create index if not exists idx_attempt_grants_company on assessment_attempt_grants (company_id);

alter table assessment_attempt_grants enable row level security;

drop policy if exists attempt_grants_select on assessment_attempt_grants;
create policy attempt_grants_select on assessment_attempt_grants
  for select using (company_id = current_employee_company_id());

drop policy if exists attempt_grants_insert on assessment_attempt_grants;
create policy attempt_grants_insert on assessment_attempt_grants
  for insert with check (company_id = current_employee_company_id() and current_employee_is_company_admin());

drop policy if exists attempt_grants_update on assessment_attempt_grants;
create policy attempt_grants_update on assessment_attempt_grants
  for update using (company_id = current_employee_company_id() and current_employee_is_company_admin())
  with check (company_id = current_employee_company_id() and current_employee_is_company_admin());

drop policy if exists attempt_grants_delete on assessment_attempt_grants;
create policy attempt_grants_delete on assessment_attempt_grants
  for delete using (company_id = current_employee_company_id() and current_employee_is_company_admin());

-- One call that adds extra attempts for one person on one test (creates the row or adds to it); the page uses this so
-- two admins clicking at once cannot overwrite each other.
create or replace function grant_extra_attempts(p_assessment_id uuid, p_employee_id uuid, p_extra integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := current_employee_company_id();
  v_me uuid;
  v_total integer;
begin
  if not current_employee_is_company_admin() then
    raise exception 'Only a company admin can give extra attempts.';
  end if;
  if p_extra is null or p_extra < 1 or p_extra > 20 then
    raise exception 'Give between 1 and 20 extra attempts.';
  end if;
  if not exists (select 1 from employees where id = p_employee_id and company_id = v_company) then
    raise exception 'That employee is not in your company.';
  end if;
  select e.id into v_me from employees e where e.auth_user_id = auth.uid() limit 1;

  insert into assessment_attempt_grants (company_id, assessment_id, employee_id, extra_attempts, granted_by)
  values (v_company, p_assessment_id, p_employee_id, p_extra, v_me)
  on conflict (assessment_id, employee_id)
  do update set extra_attempts = least(100, assessment_attempt_grants.extra_attempts + excluded.extra_attempts), granted_by = v_me, updated_at = now()
  returning extra_attempts into v_total;
  return v_total;
end;
$$;

grant execute on function grant_extra_attempts(uuid, uuid, integer) to authenticated;
