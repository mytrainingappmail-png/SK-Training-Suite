update companies set cards_per_page = 12 where id = '3b74953b-d4b1-46d5-99c4-0f8efa959277';

delete from enrollments
where employee_id = '53e54399-7ebe-477d-9ce9-d3d122b4652d'
  and company_id = '3b74953b-d4b1-46d5-99c4-0f8efa959277';
