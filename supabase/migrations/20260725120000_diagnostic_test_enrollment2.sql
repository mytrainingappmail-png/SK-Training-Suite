-- Temporary: create a test enrollment for Amit Arora (AMIT01) in
-- "Real Estate Fundamentals" so the new Course->Module->Lesson
-- drill-down UI can be exercised live. Will be deleted by a follow-up
-- migration once verification is done.
insert into enrollments (employee_id, course_id, company_id, status, completion_percentage, enrollment_type, assignment_type)
values ('53e54399-7ebe-477d-9ce9-d3d122b4652d', '89acccae-24c7-4098-9a1f-cb6d84ed7f4c', '3b74953b-d4b1-46d5-99c4-0f8efa959277', 'IN_PROGRESS', 0, 'COURSE', 'MANUAL')
on conflict do nothing;
