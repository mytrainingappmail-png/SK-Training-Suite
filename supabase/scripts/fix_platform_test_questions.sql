-- One-time repair: the PLATFORM copy of a test came over WITHOUT its questions, because the
-- first copy script read the unused assessment_questions table. The app (and the test player)
-- use question_bank + question_options.
--
-- For every PLATFORM assessment that has no questions, copy them from the company assessment it
-- was copied from (same title, code without the "PLT-" prefix). Safe to run twice: it only touches
-- assessments that still have zero questions.

do $$
declare
  v_dst uuid := (select id from companies where company_code = 'PLATFORM');
  r record; q record; v_new uuid; n_q int := 0; n_o int := 0; n_step int;
begin
  for r in
    select d.id as dst_id, s.id as src_id
    from assessments d
    join assessments s on s.assessment_code = regexp_replace(d.assessment_code, '^PLT-', '') and s.company_id <> v_dst
    where d.company_id = v_dst
      and not exists (select 1 from question_bank x where x.assessment_id = d.id)
  loop
    for q in select * from question_bank where assessment_id = r.src_id order by display_order loop
      v_new := gen_random_uuid();
      insert into question_bank
        select x.* from jsonb_populate_record(null::question_bank,
          to_jsonb(q) || jsonb_build_object('id', v_new, 'assessment_id', r.dst_id, 'question_code', 'plt-' || substr(md5(gen_random_uuid()::text), 1, 12), 'created_at', now(), 'updated_at', now())) x;
      n_q := n_q + 1;
      insert into question_options
        select x.* from question_options o
        cross join lateral jsonb_populate_record(null::question_options,
          to_jsonb(o) || jsonb_build_object('id', gen_random_uuid(), 'question_id', v_new, 'created_at', now())) x
        where o.question_id = q.id;
      get diagnostics n_step = row_count;
      n_o := n_o + n_step;
    end loop;
  end loop;
  raise notice 'questions copied: %, options copied: %', n_q, n_o;
end $$;
