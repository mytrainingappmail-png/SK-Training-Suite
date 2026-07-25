-- Copy "SATYA LEAVANTE SECTOR 104 DWARKA EXPRESSWAY GURGAON." (project,
-- Test section + its assessment/questions/options, FAQ section) from
-- Realty Smartz (RSPL001) into Siddharth & Kunal Enterprise (SKE001) so
-- it's visible under that company's Projects section too. The original
-- under Realty Smartz is left untouched.
do $$
declare
  v_old_project_id uuid := '867af5f4-ba66-4cf9-8f6d-1dd0deecf895';
  v_new_project_id uuid := gen_random_uuid();
  v_ske_company_id uuid := 'b259bfa8-bf5b-464f-b9a5-008d00efa1e4';
  v_old_assessment_id uuid := '17eb6192-f5cb-4ec2-b62a-e6998fb13427';
  v_new_assessment_id uuid := gen_random_uuid();
  v_section record;
  v_new_section_id uuid;
  v_question record;
  v_new_question_id uuid;
  v_option record;
begin
  insert into real_estate_projects (id, company_id, category_id, project_name, short_description, full_description, thumbnail_url, active, display_order)
  select v_new_project_id, v_ske_company_id, null, project_name, short_description, full_description, thumbnail_url, active, display_order
  from real_estate_projects where id = v_old_project_id;

  insert into assessments (id, lesson_id, company_id, assessment_code, assessment_title, description, assessment_type, passing_percentage, maximum_attempts, duration_minutes, question_timer_enabled, question_time_seconds, shuffle_questions, shuffle_options, negative_marking, negative_marks, show_result_immediately, show_correct_answers, auto_submit, certificate_enabled, active)
  select v_new_assessment_id, null, v_ske_company_id, 'proj-test-' || substr(md5(random()::text), 1, 8), assessment_title, description, assessment_type, passing_percentage, maximum_attempts, duration_minutes, question_timer_enabled, question_time_seconds, shuffle_questions, shuffle_options, negative_marking, negative_marks, show_result_immediately, show_correct_answers, auto_submit, certificate_enabled, active
  from assessments where id = v_old_assessment_id;

  for v_question in select * from question_bank where assessment_id = v_old_assessment_id loop
    v_new_question_id := gen_random_uuid();
    insert into question_bank (id, assessment_id, question_code, question_text, question_type, difficulty_level, marks, negative_marks, time_limit_seconds, explanation, hint, display_order, mandatory, randomize_options, attachment_url, image_url, active)
    values (v_new_question_id, v_new_assessment_id, v_question.question_code || '-ske-' || substr(md5(random()::text), 1, 6), v_question.question_text, v_question.question_type, v_question.difficulty_level, v_question.marks, v_question.negative_marks, v_question.time_limit_seconds, v_question.explanation, v_question.hint, v_question.display_order, v_question.mandatory, v_question.randomize_options, v_question.attachment_url, v_question.image_url, v_question.active);

    for v_option in select * from question_options where question_id = v_question.id loop
      insert into question_options (id, question_id, option_text, is_correct, display_order)
      values (gen_random_uuid(), v_new_question_id, v_option.option_text, v_option.is_correct, v_option.display_order);
    end loop;
  end loop;

  for v_section in select * from real_estate_project_sections where project_id = v_old_project_id loop
    v_new_section_id := gen_random_uuid();
    insert into real_estate_project_sections (id, company_id, project_id, section_type, title, display_order, page_content, assessment_id, faq_items)
    values (
      v_new_section_id,
      v_ske_company_id,
      v_new_project_id,
      v_section.section_type,
      v_section.title,
      v_section.display_order,
      v_section.page_content,
      case when v_section.assessment_id = v_old_assessment_id then v_new_assessment_id else v_section.assessment_id end,
      v_section.faq_items
    );
  end loop;

  raise notice 'Copied project % -> % (assessment % -> %) into SKE001', v_old_project_id, v_new_project_id, v_old_assessment_id, v_new_assessment_id;
end $$;
