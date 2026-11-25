-- Hide a topic from the trainees. Every company has its own training length, so a company can hide any card of an Induction day
-- (the owner's updates never bring it back, because the choice is kept in this small table of the company's own, not on the card).
-- A hidden card disappears from the trainee's day, from the "cards needed to finish the day", from reports and Pending tests, and a
-- hidden test card no longer has to be passed for the induction certificate. A whole DAY is hidden with its existing Active switch.

create table if not exists public.induction_hidden_sections (
  section_id uuid primary key references public.induction_day_sections(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_induction_hidden_company on public.induction_hidden_sections (company_id);

alter table public.induction_hidden_sections enable row level security;

drop policy if exists induction_hidden_select on public.induction_hidden_sections;
create policy induction_hidden_select on public.induction_hidden_sections
  for select using (company_id = current_employee_company_id());
drop policy if exists induction_hidden_insert on public.induction_hidden_sections;
create policy induction_hidden_insert on public.induction_hidden_sections
  for insert with check (company_id = current_employee_company_id() and current_employee_is_company_admin());
drop policy if exists induction_hidden_delete on public.induction_hidden_sections;
create policy induction_hidden_delete on public.induction_hidden_sections
  for delete using (company_id = current_employee_company_id() and current_employee_is_company_admin());

-- the induction completion check (certificate / auto-complete): a hidden test card is not required any more
CREATE OR REPLACE FUNCTION public.induction_program_complete(p_employee uuid, p_require_standalone boolean DEFAULT true)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         and not exists (select 1 from public.induction_hidden_sections hs where hs.section_id = s.id)
         and (coalesce(array_length(s.locations, 1), 0) = 0 or (v_key is not null and v_key = any (s.locations)))
         and not exists (select 1 from assessment_results r where r.employee_id = p_employee and r.assessment_id = s.assessment_id and r.passed is true)
    ) then return false; end if;
  end loop;
  return v_total > 0;
end $function$;
