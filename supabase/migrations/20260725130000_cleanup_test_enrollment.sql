-- Remove the temporary test enrollment + test thumbnail data created to
-- verify the new Course->Module->Lesson drill-down UI live.
delete from enrollments
where employee_id = '53e54399-7ebe-477d-9ce9-d3d122b4652d'
  and course_id = '89acccae-24c7-4098-9a1f-cb6d84ed7f4c';

update modules set thumbnail = '' where id = '6da2fac5-505f-49ac-b840-c8b4a10de2b1';
update lessons set thumbnail = '' where id = '77abe70b-99fc-4253-896f-2feffc2fc114';
