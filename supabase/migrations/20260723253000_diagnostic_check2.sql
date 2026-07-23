do $$
declare
  v_new_company_id uuid := '3b74953b-d4b1-46d5-99c4-0f8efa959277';
  v_row record;
  v_count int;
begin
  for v_row in select company_code, company_name, short_name, address, city, login_logo_url from companies order by created_at loop
    raise notice 'COMPANY: code=% name=% short=% addr=% city=% logo=%', v_row.company_code, v_row.company_name, v_row.short_name, v_row.address, v_row.city, v_row.login_logo_url;
  end loop;

  select count(*) into v_count from roles where company_id = v_new_company_id;
  raise notice 'RSPL001 roles: %', v_count;

  select count(*) into v_count from role_permissions rp join roles r on r.id = rp.role_id where r.company_id = v_new_company_id;
  raise notice 'RSPL001 role_permissions: %', v_count;

  select count(*) into v_count from courses where company_id = v_new_company_id;
  raise notice 'RSPL001 courses: %', v_count;

  select count(*) into v_count from modules m join courses c on c.id = m.course_id where c.company_id = v_new_company_id;
  raise notice 'RSPL001 modules: %', v_count;

  select count(*) into v_count from lessons l join modules m on m.id = l.module_id join courses c on c.id = m.course_id where c.company_id = v_new_company_id;
  raise notice 'RSPL001 lessons: %', v_count;

  select count(*) into v_count from assessments a join lessons l on l.id = a.lesson_id join modules m on m.id = l.module_id join courses c on c.id = m.course_id where c.company_id = v_new_company_id;
  raise notice 'RSPL001 assessments: %', v_count;

  select count(*) into v_count from question_bank q join assessments a on a.id = q.assessment_id join lessons l on l.id = a.lesson_id join modules m on m.id = l.module_id join courses c on c.id = m.course_id where c.company_id = v_new_company_id;
  raise notice 'RSPL001 questions: %', v_count;

  for v_row in select employee_code, first_name, last_name, active, auth_user_id from employees where company_id = v_new_company_id loop
    raise notice 'RSPL001 employee: code=% name=% % active=% auth_user_id=%', v_row.employee_code, v_row.first_name, v_row.last_name, v_row.active, v_row.auth_user_id;
  end loop;

  for v_row in select company_id, employee_code, active from employees where employee_code = 'AMIT01' loop
    raise notice 'AMIT01 row: company_id=% active=%', v_row.company_id, v_row.active;
  end loop;
end $$;
