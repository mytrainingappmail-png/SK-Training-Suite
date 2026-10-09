-- "Training Impact": one row per active employee putting their training (induction, tests, lessons) next to their
-- field performance (Performance Tracker) for a date range, so an owner can see whether trained people perform better.
-- Company admins only. Training numbers are all-time; performance numbers are for the chosen range.

create or replace function get_training_impact(p_from date, p_to date)
returns table (
  employee_id uuid,
  full_name text,
  employee_code text,
  department_id uuid,
  joining_date date,
  induction_completed boolean,
  lessons_completed int,
  assessments_taken int,
  assessments_passed int,
  avg_assessment_pct numeric,
  pt_days int,
  pt_score numeric,
  pt_bookings int,
  pt_site_visits int,
  pt_meetings int,
  pt_avg_achievement numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid := current_employee_company_id();
begin
  if v_company is null or not current_employee_is_company_admin() then
    raise exception 'Only a company administrator can see Training Impact.';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose a valid date range.';
  end if;

  return query
  select
    e.id,
    trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')),
    e.employee_code::text,
    e.department_id,
    e.joining_date,
    exists (select 1 from induction_assignments ia where ia.employee_id = e.id and (ia.status = 'completed' or ia.completed_at is not null)),
    (select count(*)::int from employee_lesson_progress lp where lp.employee_id = e.id and lp.completed_at is not null),
    (select count(distinct ar.assessment_id)::int from assessment_results ar where ar.employee_id = e.id),
    (select count(distinct ar.assessment_id)::int from assessment_results ar where ar.employee_id = e.id and ar.passed),
    (select round(avg(ar.percentage), 1) from assessment_results ar where ar.employee_id = e.id),
    (select count(*)::int from pt_reports r where r.employee_id = e.id and r.work_date between p_from and p_to),
    (select coalesce(sum(r.score), 0) from pt_reports r where r.employee_id = e.id and r.work_date between p_from and p_to),
    (select coalesce(sum(r.bookings), 0)::int from pt_reports r where r.employee_id = e.id and r.work_date between p_from and p_to),
    (select coalesce(sum(r.sv_done), 0)::int from pt_reports r where r.employee_id = e.id and r.work_date between p_from and p_to),
    (select coalesce(sum(r.f2f_done), 0)::int from pt_reports r where r.employee_id = e.id and r.work_date between p_from and p_to),
    (select round(avg(r.achievement_pct), 1) from pt_reports r where r.employee_id = e.id and r.work_date between p_from and p_to and r.achievement_pct is not null)
  from employees e
  where e.company_id = v_company and e.active
  order by 2;
end;
$$;

revoke all on function get_training_impact(date, date) from public;
grant execute on function get_training_impact(date, date) to authenticated;
