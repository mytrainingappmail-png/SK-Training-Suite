-- A fuller "take your data with you" export for a customer that leaves: besides the company,
-- branches, departments, employees and courses it now also carries the course content (chapters,
-- lessons), who was enrolled and how far they got, test results and certificates — all keyed by
-- employee code / course code so the file is readable on its own.
--
-- Same access rule as before: platform owner only. Replaces the earlier, smaller version.

create or replace function public.export_company_data(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not current_company_is_platform_operator() then
    raise exception 'Only the platform administrator can export company data.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'exported_at', now(),
    'company', (select to_jsonb(c) from companies c where c.id = p_company_id),
    'branches', coalesce((select jsonb_agg(to_jsonb(b)) from branches b where b.company_id = p_company_id), '[]'::jsonb),
    'departments', coalesce((select jsonb_agg(to_jsonb(d)) from departments d where d.company_id = p_company_id), '[]'::jsonb),
    'employees', coalesce((select jsonb_agg(jsonb_build_object(
        'employee_code', e.employee_code, 'first_name', e.first_name, 'last_name', e.last_name,
        'email', e.email, 'mobile', e.mobile, 'joining_date', e.joining_date, 'active', e.active))
      from employees e where e.company_id = p_company_id), '[]'::jsonb),
    'courses', coalesce((select jsonb_agg(jsonb_build_object(
        'course_code', c.course_code, 'course_name', c.course_name, 'short_description', c.short_description,
        'level', c.level, 'active', c.active,
        'chapters', coalesce((select jsonb_agg(jsonb_build_object(
            'chapter', m.module_name, 'order', m.module_order,
            'lessons', coalesce((select jsonb_agg(jsonb_build_object(
                'title', l.lesson_title, 'type', l.lesson_type, 'content', l.content, 'video_url', l.video_url,
                'files', coalesce((select jsonb_agg(jsonb_build_object('title', r.resource_title, 'url', r.file_url))
                                   from learning_resources r where r.lesson_id = l.id), '[]'::jsonb)
              ) order by l.display_order) from lessons l where l.module_id = m.id), '[]'::jsonb)
          ) order by m.module_order) from modules m where m.course_id = c.id), '[]'::jsonb)))
      from courses c where c.company_id = p_company_id), '[]'::jsonb),
    'enrollments', coalesce((select jsonb_agg(jsonb_build_object(
        'employee_code', e.employee_code, 'course_code', c.course_code, 'status', n.status,
        'completion_percentage', n.completion_percentage, 'completed_at', n.completed_at, 'assigned_at', n.assigned_at))
      from enrollments n
      join employees e on e.id = n.employee_id
      left join courses c on c.id = n.course_id
      where n.company_id = p_company_id), '[]'::jsonb),
    'test_results', coalesce((select jsonb_agg(jsonb_build_object(
        'employee_code', e.employee_code, 'test', a.assessment_title, 'percentage', r.percentage,
        'passed', r.passed, 'date', r.evaluated_at))
      from assessment_results r
      join assessments a on a.id = r.assessment_id
      join employees e on e.id = r.employee_id
      where a.company_id = p_company_id), '[]'::jsonb),
    'certificates', coalesce((select jsonb_agg(jsonb_build_object(
        'employee_code', e.employee_code, 'certificate_no', ce.certificate_no, 'title', ce.certificate_title,
        'issue_date', ce.issue_date))
      from certificates ce
      join employees e on e.id = ce.employee_id
      where e.company_id = p_company_id), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.export_company_data(uuid) from public, anon;
grant execute on function public.export_company_data(uuid) to authenticated;
