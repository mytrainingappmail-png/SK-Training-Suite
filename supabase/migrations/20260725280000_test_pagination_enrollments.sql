insert into enrollments (employee_id, course_id, company_id, status, completion_percentage, enrollment_type, assignment_type)
select '53e54399-7ebe-477d-9ce9-d3d122b4652d', id, '3b74953b-d4b1-46d5-99c4-0f8efa959277', 'IN_PROGRESS', 0, 'COURSE', 'MANUAL'
from courses
where company_id = '3b74953b-d4b1-46d5-99c4-0f8efa959277'
limit 3;
