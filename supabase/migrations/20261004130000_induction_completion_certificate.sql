-- Induction: when an employee has finished the WHOLE induction — every day applicable to them completed and every
-- test in those days passed — the system (not the browser) automatically
--   * marks their induction assignment as completed, and
--   * issues them an "Induction completion" certificate (shown in My Certificates, downloadable like any other).
-- Both are switches in induction_settings (default ON) and never block the day / test the employee just finished.
--
-- "Applicable to them" follows exactly what the employee's screen shows: active days of their company, their branch's
-- own copy instead of the shared one, and only content for their location (city of their branch). Standalone parts
-- (like a company overview) count too unless the admin switches that off.

create table if not exists public.induction_settings (
  company_id                 uuid primary key references public.companies(id) on delete cascade,
  auto_complete              boolean not null default true,
  certificate_enabled        boolean not null default true,
  certificate_title          text    not null default 'Induction Program',
  require_standalone_days    boolean not null default true,
  updated_at                 timestamptz not null default now()
);
alter table public.induction_settings enable row level security;
revoke all on public.induction_settings from anon;

drop policy if exists induction_settings_company_read on public.induction_settings;
create policy induction_settings_company_read on public.induction_settings
  for select to authenticated using (company_id = public.current_employee_company_id());
drop policy if exists induction_settings_admin_insert on public.induction_settings;
create policy induction_settings_admin_insert on public.induction_settings
  for insert to authenticated with check (company_id = public.current_employee_company_id() and public.current_employee_is_company_admin());
drop policy if exists induction_settings_admin_update on public.induction_settings;
create policy induction_settings_admin_update on public.induction_settings
  for update to authenticated
  using (company_id = public.current_employee_company_id() and public.current_employee_is_company_admin())
  with check (company_id = public.current_employee_company_id() and public.current_employee_is_company_admin());

-- same city matching as the app (src/constants/locations.ts): a city or branch name -> location key
create or replace function public.induction_clean_text(p text) returns text language sql immutable as $$
  select trim(regexp_replace(regexp_replace(lower(coalesce(p, '')), '[.\-_,]', ' ', 'g'), '\s+', ' ', 'g'))
$$;

create or replace function public.induction_location_key(p_city text, p_branch_name text) returns text language sql immutable as $$
  select coalesce(
    (select v.k from (values
    ('gurgaon', 'gurgaon'),
    ('gurgaon', 'gurugram'),
    ('mohali', 'mohali'),
    ('mohali', 'sas nagar'),
    ('mohali', 's a s nagar'),
    ('mohali', 'sahibzada ajit singh nagar'),
    ('noida', 'noida'),
    ('greater-noida', 'greater noida'),
    ('faridabad', 'faridabad'),
    ('ghaziabad', 'ghaziabad'),
    ('delhi', 'delhi'),
    ('delhi', 'new delhi'),
    ('chandigarh', 'chandigarh'),
    ('panchkula', 'panchkula'),
    ('jaipur', 'jaipur'),
    ('lucknow', 'lucknow'),
    ('mumbai', 'mumbai'),
    ('mumbai', 'bombay'),
    ('navi-mumbai', 'navi mumbai'),
    ('thane', 'thane'),
    ('pune', 'pune'),
    ('pune', 'poona'),
    ('ahmedabad', 'ahmedabad'),
    ('indore', 'indore'),
    ('bangalore', 'bangalore'),
    ('bangalore', 'bengaluru'),
    ('hyderabad', 'hyderabad'),
    ('chennai', 'chennai'),
    ('chennai', 'madras'),
    ('kolkata', 'kolkata'),
    ('kolkata', 'calcutta')
    ) as v(k, n) where public.induction_clean_text(p_city) <> '' and v.n = public.induction_clean_text(p_city) limit 1),
    (select v.k from (values
    ('gurgaon', 'gurgaon'),
    ('gurgaon', 'gurugram'),
    ('mohali', 'mohali'),
    ('mohali', 'sas nagar'),
    ('mohali', 's a s nagar'),
    ('mohali', 'sahibzada ajit singh nagar'),
    ('noida', 'noida'),
    ('greater-noida', 'greater noida'),
    ('faridabad', 'faridabad'),
    ('ghaziabad', 'ghaziabad'),
    ('delhi', 'delhi'),
    ('delhi', 'new delhi'),
    ('chandigarh', 'chandigarh'),
    ('panchkula', 'panchkula'),
    ('jaipur', 'jaipur'),
    ('lucknow', 'lucknow'),
    ('mumbai', 'mumbai'),
    ('mumbai', 'bombay'),
    ('navi-mumbai', 'navi mumbai'),
    ('thane', 'thane'),
    ('pune', 'pune'),
    ('pune', 'poona'),
    ('ahmedabad', 'ahmedabad'),
    ('indore', 'indore'),
    ('bangalore', 'bangalore'),
    ('bangalore', 'bengaluru'),
    ('hyderabad', 'hyderabad'),
    ('chennai', 'chennai'),
    ('chennai', 'madras'),
    ('kolkata', 'kolkata'),
    ('kolkata', 'calcutta')
    ) as v(k, n) where public.induction_clean_text(p_branch_name) <> '' and v.n = public.induction_clean_text(p_branch_name) limit 1)
  )
$$;

-- Has this employee finished everything that applies to them?
create or replace function public.induction_program_complete(p_employee uuid, p_require_standalone boolean default true) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare e record; v_key text; d record; v_total integer := 0;
begin
  select emp.company_id, emp.branch_id, b.city, b.branch_name into e
    from employees emp left join branches b on b.id = emp.branch_id where emp.id = p_employee;
  if not found then return false; end if;
  v_key := public.induction_location_key(e.city, e.branch_name);

  for d in
    select dd.id from induction_days dd
     where dd.company_id = e.company_id and dd.active
       and (p_require_standalone or not coalesce(dd.standalone, false))
       and ( (dd.branch_id is null and not exists (select 1 from induction_days o where o.source_id = dd.id and o.branch_id is not null and e.branch_id is not null and o.branch_id = e.branch_id))
          or (dd.branch_id is not null and e.branch_id is not null and dd.branch_id = e.branch_id) )
       and (coalesce(array_length(dd.locations, 1), 0) = 0 or (v_key is not null and v_key = any (dd.locations)))
       and ( not exists (select 1 from induction_day_sections s where s.day_id = dd.id)
          or exists (select 1 from induction_day_sections s where s.day_id = dd.id
                      and (coalesce(array_length(s.locations, 1), 0) = 0 or (v_key is not null and v_key = any (s.locations)))) )
  loop
    v_total := v_total + 1;
    if not exists (select 1 from induction_day_completions c where c.day_id = d.id and c.employee_id = p_employee) then return false; end if;
    if exists (
      select 1 from induction_day_sections s
       where s.day_id = d.id and s.section_type = 'test' and s.assessment_id is not null
         and (coalesce(array_length(s.locations, 1), 0) = 0 or (v_key is not null and v_key = any (s.locations)))
         and not exists (select 1 from assessment_results r where r.employee_id = p_employee and r.assessment_id = s.assessment_id and r.passed is true)
    ) then return false; end if;
  end loop;
  return v_total > 0;
end $$;

-- If so: complete the assignment and issue the certificate (each only once, each only if switched on).
create or replace function public.induction_finish_if_complete(p_employee uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e record; st record; a record; v_template text; v_title text;
begin
  select company_id into e from employees where id = p_employee;
  if not found then return; end if;
  select * into st from induction_settings where company_id = e.company_id;
  select id, status into a from induction_assignments where employee_id = p_employee order by assigned_at desc limit 1;
  if not found then return; end if;
  if not public.induction_program_complete(p_employee, coalesce(st.require_standalone_days, true)) then return; end if;

  if coalesce(st.auto_complete, true) and a.status <> 'completed' then
    update induction_assignments set status = 'completed', completed_at = now() where id = a.id;
  end if;

  if coalesce(st.certificate_enabled, true)
     and not exists (select 1 from certificates c where c.employee_id = p_employee and c.remarks like 'induction:%' and c.active is not false) then
    v_title := coalesce(nullif(trim(st.certificate_title), ''), 'Induction Program');
    select t.template_name into v_template from certificate_templates t where t.default_template is true order by t.created_at limit 1;
    begin
      insert into certificates (employee_id, certificate_no, certificate_title, issue_date, template_name, generated, published, active, remarks)
      values (p_employee, 'IND-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)), v_title, current_date, v_template, true, true, true, 'induction:' || a.id);
    exception when others then
      -- the day / test the employee just finished matters more; an admin can use "Check everyone now" later
      raise warning 'induction certificate not issued automatically: %', sqlerrm;
    end;
  end if;
end $$;

create or replace function public.induction_completion_trigger_day() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.induction_finish_if_complete(new.employee_id);
  exception when others then
    raise warning 'induction completion check failed: %', sqlerrm;
  end;
  return new;
end $$;

create or replace function public.induction_completion_trigger_result() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.passed is true and new.employee_id is not null then
    begin
      perform public.induction_finish_if_complete(new.employee_id);
    exception when others then
      raise warning 'induction completion check failed: %', sqlerrm;
    end;
  end if;
  return new;
end $$;

drop trigger if exists trg_induction_complete_on_day on public.induction_day_completions;
create trigger trg_induction_complete_on_day after insert or update on public.induction_day_completions
  for each row execute function public.induction_completion_trigger_day();
drop trigger if exists trg_induction_complete_on_pass on public.assessment_results;
create trigger trg_induction_complete_on_pass after insert or update of passed on public.assessment_results
  for each row execute function public.induction_completion_trigger_result();

-- For admins: check everyone in the company now (e.g. people who finished before this switch existed).
create or replace function public.induction_check_all_complete() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; v_company uuid := public.current_employee_company_id(); c_before integer; c_after integer; a_before integer; a_after integer;
begin
  if not (public.current_employee_is_company_admin() or public.current_company_is_platform_operator()) then
    raise exception 'Only an administrator can do this.' using errcode = '42501';
  end if;
  select count(*) into c_before from certificates c join employees e on e.id = c.employee_id where e.company_id = v_company and c.remarks like 'induction:%';
  select count(*) into a_before from induction_assignments a where a.company_id = v_company and a.status = 'completed';
  for r in select distinct a.employee_id from induction_assignments a where a.company_id = v_company loop
    perform public.induction_finish_if_complete(r.employee_id);
  end loop;
  select count(*) into c_after from certificates c join employees e on e.id = c.employee_id where e.company_id = v_company and c.remarks like 'induction:%';
  select count(*) into a_after from induction_assignments a where a.company_id = v_company and a.status = 'completed';
  return jsonb_build_object('completed', a_after - a_before, 'certificates', c_after - c_before);
end $$;

revoke all on function public.induction_clean_text(text), public.induction_location_key(text, text),
  public.induction_program_complete(uuid, boolean), public.induction_finish_if_complete(uuid), public.induction_completion_trigger_day(), public.induction_completion_trigger_result() from public, anon, authenticated;
revoke all on function public.induction_check_all_complete() from public, anon;
grant execute on function public.induction_check_all_complete() to authenticated;
