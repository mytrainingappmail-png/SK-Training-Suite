-- Certificates for tests: when an employee PASSES a test whose "certificate" switch is on, the
-- certificate is issued straight away.
--
-- Until now a course test could be marked "certificate eligible", but nothing ever created the
-- certificate: an administrator had to issue each one by hand. This does it automatically.
--
--   * only fires for a PASSED result of an assessment with certificate_enabled = true
--   * never issues a second certificate to the same employee for the same test
--   * uses the default certificate design (the viewer falls back to it anyway)
--   * never blocks the test result: if the certificate cannot be created (for example the plan's
--     monthly certificate limit is reached) the result is still saved and the certificate can be
--     issued by an administrator later.
--
-- No existing assessment has certificate_enabled = true, so nothing changes for current data.

create or replace function public.issue_certificate_on_pass()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment assessments%rowtype;
  v_template text;
begin
  if new.passed is not true or new.employee_id is null or new.assessment_id is null then
    return new;
  end if;

  select * into v_assessment from assessments where id = new.assessment_id;
  if not found or coalesce(v_assessment.certificate_enabled, false) is not true then
    return new;
  end if;

  if exists (
    select 1 from certificates c
    where c.employee_id = new.employee_id and c.assessment_id = new.assessment_id and c.active is not false
  ) then
    return new;
  end if;

  select t.template_name into v_template
  from certificate_templates t
  where t.default_template is true
  order by t.created_at
  limit 1;

  begin
    insert into certificates (
      assessment_result_id, employee_id, assessment_id, certificate_no, certificate_title,
      issue_date, template_name, generated, published, active
    ) values (
      new.id, new.employee_id, new.assessment_id,
      'CERT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
      v_assessment.assessment_title, current_date, v_template, true, true, true
    );
    update assessment_results set certificate_generated = true where id = new.id;
  exception when others then
    -- the test result matters more than the certificate; an administrator can issue it later
    raise warning 'certificate not issued automatically: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.issue_certificate_on_pass() from public, anon, authenticated;

drop trigger if exists trg_issue_certificate_on_pass on public.assessment_results;
create trigger trg_issue_certificate_on_pass
  after insert on public.assessment_results
  for each row execute function public.issue_certificate_on_pass();
