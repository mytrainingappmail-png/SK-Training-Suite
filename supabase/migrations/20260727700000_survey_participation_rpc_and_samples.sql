-- "Kitne logon ne participate nahi kiya" needs a denominator (total
-- eligible people) to turn a raw response count into a rate — but a
-- survey admin session (quiz_admins) has no RLS access to the
-- employees table at all (a different identity domain entirely). This
-- narrow, security-definer RPC exposes only a COUNT, scoped to the
-- admin's own company — never who is or isn't in it, keeping every
-- individual response fully anonymous while still answering "320 of
-- 500 have responded."

create or replace function get_company_active_employee_count() returns int
language sql stable security definer set search_path = public
as $$
  select count(*)::int from employees where company_id = current_quiz_admin_company_id() and active = true;
$$;

grant execute on function get_company_active_employee_count() to authenticated;

-- Two ready-to-explore sample surveys, one of each intended flavor —
-- both start as drafts so nobody accidentally receives a live link to
-- test/placeholder content; publish them from the Surveys tab when ready.

insert into surveys (id, company_id, title, description, status) values
  ('66666666-6666-6666-6666-666666666601', (select id from companies where company_code = 'SKE001'), 'Employee Happiness Pulse', 'A few quick questions about how things are going — completely anonymous.', 'draft'),
  ('66666666-6666-6666-6666-666666666602', (select id from companies where company_code = 'SKE001'), 'HR Policy Feedback', 'Help us shape a few upcoming HR decisions — your honest input matters.', 'draft');

insert into survey_questions (id, survey_id, question_text, type, required, display_order) values
  ('66666666-6666-6666-6666-666666666611', '66666666-6666-6666-6666-666666666601', 'Overall, are you happy working here?', 'single_choice', true, 0);
insert into survey_question_options (question_id, option_text, sentiment, display_order) values
  ('66666666-6666-6666-6666-666666666611', 'Yes, very happy', 'positive', 0),
  ('66666666-6666-6666-6666-666666666611', 'Somewhat happy', 'neutral', 1),
  ('66666666-6666-6666-6666-666666666611', 'Not really', 'negative', 2);

insert into survey_questions (id, survey_id, question_text, type, required, scale_min, scale_max, display_order) values
  ('66666666-6666-6666-6666-666666666612', '66666666-6666-6666-6666-666666666601', 'How would you rate your work-life balance?', 'scale', true, 1, 10, 1);

insert into survey_questions (id, survey_id, question_text, type, required, display_order) values
  ('66666666-6666-6666-6666-666666666613', '66666666-6666-6666-6666-666666666601', 'What would make your work life better?', 'open_text', false, 2);

insert into survey_questions (id, survey_id, question_text, type, required, display_order) values
  ('66666666-6666-6666-6666-666666666621', '66666666-6666-6666-6666-666666666602', 'Which HR policy needs the most improvement?', 'multi_choice', true, 0);
insert into survey_question_options (question_id, option_text, sentiment, display_order) values
  ('66666666-6666-6666-6666-666666666621', 'Leave Policy', 'negative', 0),
  ('66666666-6666-6666-6666-666666666621', 'Work From Home Policy', 'negative', 1),
  ('66666666-6666-6666-6666-666666666621', 'Increment / Appraisal Process', 'negative', 2),
  ('66666666-6666-6666-6666-666666666621', 'None — everything is fine', 'positive', 3);

insert into survey_questions (id, survey_id, question_text, type, required, scale_min, scale_max, display_order) values
  ('66666666-6666-6666-6666-666666666622', '66666666-6666-6666-6666-666666666602', 'How fair do you feel the current appraisal process is?', 'scale', true, 1, 5, 1);

insert into survey_questions (id, survey_id, question_text, type, required, display_order) values
  ('66666666-6666-6666-6666-666666666623', '66666666-6666-6666-6666-666666666602', 'Any specific suggestions for HR?', 'open_text', false, 2);
