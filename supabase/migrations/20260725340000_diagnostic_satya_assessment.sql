do $$
declare
  v_rec record;
  v_opt record;
begin
  raise notice '--- ASSESSMENT ---';
  for v_rec in select * from assessments where id = '17eb6192-f5cb-4ec2-b62a-e6998fb13427' loop
    raise notice 'title=% code=% passing=% duration=% shuffle_q=% shuffle_o=%', v_rec.assessment_title, v_rec.assessment_code, v_rec.passing_percentage, v_rec.duration_minutes, v_rec.shuffle_questions, v_rec.shuffle_options;
  end loop;

  raise notice '--- QUESTIONS ---';
  for v_rec in select * from question_bank where assessment_id = '17eb6192-f5cb-4ec2-b62a-e6998fb13427' loop
    raise notice 'q id=% text=% marks=%', v_rec.id, v_rec.question_text, v_rec.marks;
    for v_opt in select * from question_options where question_id = v_rec.id loop
      raise notice '   opt id=% text=% correct=%', v_opt.id, v_opt.option_text, v_opt.is_correct;
    end loop;
  end loop;
end $$;
