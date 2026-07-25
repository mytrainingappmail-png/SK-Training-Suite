delete from learning_path_enrollments
where employee_id = '53e54399-7ebe-477d-9ce9-d3d122b4652d'
  and learning_path_id = '806b84bc-414d-4b00-8bcd-65c1543ee451';

insert into learning_path_enrollments (employee_id, learning_path_id, enrollment_type, active, status)
values ('53e54399-7ebe-477d-9ce9-d3d122b4652d', 'fbde934f-8cdc-4b5b-b2eb-20f083c129c0', 'employee', true, 'not_started')
on conflict do nothing;

insert into enrollments (employee_id, course_id, company_id, status, completion_percentage, enrollment_type, assignment_type)
values ('53e54399-7ebe-477d-9ce9-d3d122b4652d', '89acccae-24c7-4098-9a1f-cb6d84ed7f4c', '3b74953b-d4b1-46d5-99c4-0f8efa959277', 'IN_PROGRESS', 25, 'COURSE', 'MANUAL')
on conflict do nothing;
