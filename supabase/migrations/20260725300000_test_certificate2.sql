do $$
declare
  v_assessment_id uuid;
begin
  select id into v_assessment_id from assessments where lesson_id is not null limit 1;

  insert into certificates (employee_id, assessment_id, certificate_no, certificate_title, issue_date, generated, published, active, template_name)
  values (
    '53e54399-7ebe-477d-9ce9-d3d122b4652d',
    v_assessment_id,
    'CERT-TEST-0002',
    'CERTIFICATE OF ACHIEVEMENT',
    now(),
    true,
    true,
    true,
    'Standard Certificate'
  );
end $$;
