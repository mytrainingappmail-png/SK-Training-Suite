-- Rollback for 20261001140000_exam_quiz_integrity.sql
-- Restores the previous function bodies (captured 2026-09-30). The added exam_sessions columns are left in place (harmless).

CREATE OR REPLACE FUNCTION public.create_exam_session(p_quiz_id uuid, p_duration_seconds integer, p_start_in_seconds integer DEFAULT NULL::integer, p_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS SETOF exam_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_quiz record;
  v_opens timestamptz;
  v_pin text;
  v_row exam_sessions;
  i int;
begin
  select qz.company_id, qz.mode, qz.status into v_quiz from quizzes qz where qz.id = p_quiz_id;
  if v_quiz.company_id is null or v_quiz.company_id <> current_quiz_admin_company_id() or not current_quiz_admin_can_edit() then
    raise exception 'Exam not found or not authorized.';
  end if;
  if v_quiz.mode <> 'exam' then raise exception 'This is a Live Quiz, not an exam.'; end if;
  if v_quiz.status <> 'published' then raise exception 'Publish the exam before starting it.'; end if;
  if not quiz_module_enabled_for_company(v_quiz.company_id) then raise exception 'Live Quiz is not enabled for this company.'; end if;
  if not exists (select 1 from quiz_questions q where q.quiz_id = p_quiz_id and not q.is_hidden) then
    raise exception 'This exam has no visible questions.';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 60 or p_duration_seconds > 86400 then
    raise exception 'Duration must be between 1 minute and 24 hours.';
  end if;

  v_opens := case
    when p_start_at is not null then greatest(p_start_at, now())
    when p_start_in_seconds is not null and p_start_in_seconds > 0 then now() + make_interval(secs => p_start_in_seconds)
    else now()
  end;
  if v_opens > now() + interval '30 days' then raise exception 'Start time is too far ahead.'; end if;

  for i in 1 .. 8 loop
    v_pin := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
    begin
      insert into exam_sessions (quiz_id, company_id, host_admin_id, pin, duration_seconds, opens_at, deadline_at)
      values (p_quiz_id, v_quiz.company_id,
        (select qa.id from quiz_admins qa where qa.auth_user_id = auth.uid() limit 1),
        v_pin, p_duration_seconds, v_opens, v_opens + make_interval(secs => p_duration_seconds))
      returning * into v_row;
      return next v_row;
      return;
    exception when unique_violation then
      null;
    end;
  end loop;
  raise exception 'Could not allocate a unique PIN. Please try again.';
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_hotspot_tap(p_session_id uuid, p_question_id uuid, p_x numeric, p_y numeric)
 RETURNS TABLE(is_correct boolean, zone_label text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
  v_zones jsonb;
  v_idx int;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  if v_sub is not null then raise exception 'You have already submitted this exam.'; end if;

  select * into v_s from exam_sessions es where es.id = p_session_id;
  if now() < v_s.opens_at or now() > v_s.deadline_at + interval '20 seconds' or v_s.finished_at is not null then
    raise exception 'The exam is not currently open.';
  end if;

  select q.hotspot_zones into v_zones
  from quiz_questions q where q.id = p_question_id and q.quiz_id = v_s.quiz_id and q.type = 'hotspot' and not q.is_hidden;
  if v_zones is null then raise exception 'That question is not part of this exam.'; end if;

  v_idx := hotspot_zone_index_hit(v_zones, p_x, p_y);
  if v_idx is null then
    return query select false, null::text;
  else
    return query select true, nullif(trim(coalesce(v_zones->v_idx->>'label', '')), '');
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_exam(p_session_id uuid, p_reason text DEFAULT 'manual'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pid uuid;
  v_sub timestamptz;
begin
  -- FOR UPDATE serialises against save_exam_answer (which also locks this
  -- row), so an answer can't land after the grade pass and silently score 0.
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid()
  for update;
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  if v_sub is not null then return; end if; -- already submitted: idempotent

  update exam_participants
  set submitted_at = now(), submit_reason = case when p_reason = 'timeout' then 'timeout' else 'manual' end
  where id = v_pid;

  begin
    perform exam_grade_participant(v_pid);
  exception when others then
    raise warning 'submit_exam: grading failed for participant %: %', v_pid, sqlerrm;
  end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_exam_paper(p_session_id uuid)
 RETURNS TABLE(question_position integer, question_id uuid, question_text text, type text, marks integer, image_url text, option_id uuid, option_text text, option_order integer, saved_selected_option_id uuid, saved_click_x numeric, saved_click_y numeric, saved_text text, saved_image_paths text[], saved_flagged boolean, saved_hotspot_taps jsonb, hotspot_zone_count integer, saved_is_correct boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
  v_shuffle_q boolean;
  v_shuffle_o boolean;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  select * into v_s from exam_sessions es where es.id = p_session_id;
  if now() < v_s.opens_at then raise exception 'The exam has not started yet.'; end if;
  if v_sub is not null then raise exception 'You have already submitted this exam.'; end if;
  if v_s.finished_at is not null or now() > v_s.deadline_at + interval '90 seconds' then raise exception 'This exam''s time is over.'; end if;

  select coalesce(qz.shuffle_questions_per_participant, false), coalesce(qz.shuffle_options, false)
    into v_shuffle_q, v_shuffle_o from quizzes qz where qz.id = v_s.quiz_id;

  return query
  with qs as (
    select q.*, row_number() over (
      order by case when v_shuffle_q then md5(q.id::text || v_pid::text) else lpad(q.display_order::text, 10, '0') end
    )::int as pos
    from quiz_questions q where q.quiz_id = v_s.quiz_id and not q.is_hidden
  )
  select qs.pos, qs.id, qs.question_text, qs.type, qs.marks, qs.image_url,
    o.id, o.option_text,
    case when o.id is null then null
         when v_shuffle_o and qs.type <> 'truefalse' then (row_number() over (partition by qs.id order by md5(o.id::text || v_pid::text)))::int
         else (row_number() over (partition by qs.id order by o.display_order))::int end,
    a.selected_option_id, a.click_x, a.click_y, a.text_answer, coalesce(a.image_paths, '{}'::text[]), coalesce(a.flagged, false),
    coalesce(a.hotspot_taps, '[]'::jsonb),
    case when qs.hotspot_zones is not null and jsonb_typeof(qs.hotspot_zones) = 'array' then jsonb_array_length(qs.hotspot_zones) else null end,
    a.is_correct
  from qs
  left join quiz_question_options o on o.question_id = qs.id
  left join exam_answers a on a.question_id = qs.id and a.participant_id = v_pid
  order by qs.pos, 9;
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_exam_answer(p_session_id uuid, p_question_id uuid, p_selected_option_id uuid DEFAULT NULL::uuid, p_click_x numeric DEFAULT NULL::numeric, p_click_y numeric DEFAULT NULL::numeric, p_text_answer text DEFAULT NULL::text, p_image_paths text[] DEFAULT NULL::text[], p_flagged boolean DEFAULT false, p_hotspot_taps jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(saved_is_correct boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
  v_prefix text;
  v_type text;
  v_marks int;
  v_zone_count int;
  v_empty boolean;
  v_taps jsonb := '[]'::jsonb;
  v_is_correct boolean;
  v_marks_awarded numeric;
  v_auto_graded boolean;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid()
  for update;
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  if v_sub is not null then raise exception 'You have already submitted this exam.'; end if;

  select * into v_s from exam_sessions es where es.id = p_session_id;
  if now() < v_s.opens_at then raise exception 'The exam has not started yet.'; end if;
  if v_s.finished_at is not null or now() > v_s.deadline_at + interval '20 seconds' then
    raise exception 'The exam time is over — answers are locked.';
  end if;

  select q.type, q.marks,
         case when jsonb_typeof(q.hotspot_zones) = 'array' then jsonb_array_length(q.hotspot_zones) end
    into v_type, v_marks, v_zone_count
  from quiz_questions q where q.id = p_question_id and q.quiz_id = v_s.quiz_id and not q.is_hidden;
  if v_type is null then raise exception 'That question is not part of this exam.'; end if;

  if p_selected_option_id is not null and not exists (
    select 1 from quiz_question_options o where o.id = p_selected_option_id and o.question_id = p_question_id
  ) then raise exception 'That option does not belong to this question.'; end if;

  if p_text_answer is not null and length(p_text_answer) > 20000 then raise exception 'Answer is too long.'; end if;

  if p_hotspot_taps is not null then
    if jsonb_typeof(p_hotspot_taps) <> 'array' then raise exception 'Invalid tap data.'; end if;
    if jsonb_array_length(p_hotspot_taps) > 40 then raise exception 'Too many tapped points.'; end if;

    -- Only a hotspot question carries taps. Rebuild each one from scratch:
    -- numeric x/y inside the 0-100 image space, optional boolean `correct`,
    -- optional label capped at 80 chars — nothing else the client sent survives.
    if v_type = 'hotspot' then
      select coalesce(jsonb_agg(
               jsonb_strip_nulls(jsonb_build_object(
                 'x', n.x,
                 'y', n.y,
                 'correct', case when jsonb_typeof(e.t->'correct') = 'boolean' then e.t->'correct' end,
                 'label', case when jsonb_typeof(e.t->'label') = 'string' then to_jsonb(left(e.t->>'label', 80)) end
               )) order by e.ord), '[]'::jsonb)
        into v_taps
      from jsonb_array_elements(p_hotspot_taps) with ordinality as e(t, ord),
           lateral (select
             case when jsonb_typeof(e.t) = 'object' and jsonb_typeof(e.t->'x') = 'number' and jsonb_typeof(e.t->'y') = 'number'
                  then (e.t->>'x')::numeric end as x,
             case when jsonb_typeof(e.t) = 'object' and jsonb_typeof(e.t->'x') = 'number' and jsonb_typeof(e.t->'y') = 'number'
                  then (e.t->>'y')::numeric end as y
           ) n
      where n.x between 0 and 100 and n.y between 0 and 100
        and e.ord <= coalesce(v_zone_count, 1);
    end if;
  end if;

  v_prefix := p_session_id::text || '/' || v_pid::text || '/';
  if p_image_paths is not null then
    if cardinality(p_image_paths) > 5 then raise exception 'You can attach up to 5 photos per answer.'; end if;
    if exists (select 1 from unnest(p_image_paths) pth where left(pth, length(v_prefix)) <> v_prefix) then
      raise exception 'Invalid photo.';
    end if;
  end if;

  v_empty := p_selected_option_id is null and p_click_x is null and jsonb_array_length(v_taps) = 0
    and coalesce(trim(p_text_answer), '') = ''
    and coalesce(cardinality(p_image_paths), 0) = 0 and not coalesce(p_flagged, false);

  if v_empty then
    delete from exam_answers where participant_id = v_pid and question_id = p_question_id;
    return query select null::boolean;
    return;
  end if;

  if v_type in ('mcq', 'truefalse') and p_selected_option_id is not null then
    v_is_correct := coalesce((select o.is_correct from quiz_question_options o where o.id = p_selected_option_id), false);
    v_marks_awarded := case when v_is_correct then v_marks else 0 end;
    v_auto_graded := true;
  else
    v_is_correct := null;
    v_marks_awarded := null;
    v_auto_graded := false;
  end if;

  insert into exam_answers (participant_id, question_id, selected_option_id, click_x, click_y, text_answer, image_paths, flagged, hotspot_taps, is_correct, marks_awarded, auto_graded, updated_at)
  values (v_pid, p_question_id, p_selected_option_id, p_click_x, p_click_y, nullif(p_text_answer, ''), coalesce(p_image_paths, '{}'), coalesce(p_flagged, false), v_taps, v_is_correct, v_marks_awarded, v_auto_graded, now())
  on conflict (participant_id, question_id) do update
    set selected_option_id = excluded.selected_option_id,
        click_x = excluded.click_x,
        click_y = excluded.click_y,
        text_answer = excluded.text_answer,
        image_paths = excluded.image_paths,
        flagged = excluded.flagged,
        hotspot_taps = excluded.hotspot_taps,
        is_correct = excluded.is_correct,
        marks_awarded = excluded.marks_awarded,
        auto_graded = excluded.auto_graded,
        updated_at = now();

  return query select v_is_correct;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_exam_results(p_session_id uuid)
 RETURNS TABLE(participant_id uuid, display_name text, submitted_at timestamp with time zone, submit_reason text, tab_switches integer, auto_marks numeric, manual_marks numeric, pending_written integer, possible_marks numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_s exam_sessions;
begin
  select * into v_s from exam_sessions es where es.id = p_session_id and es.company_id = current_quiz_admin_company_id();
  if v_s.id is null then raise exception 'Exam not found or not authorized.'; end if;
  if v_s.finished_at is null then raise exception 'Results are available only after the exam has finished.'; end if;

  return query
  select ep.id, ep.display_name, ep.submitted_at, ep.submit_reason, ep.tab_switches,
    coalesce((select sum(a.marks_awarded) from exam_answers a where a.participant_id = ep.id and a.auto_graded), 0)::numeric,
    coalesce((select sum(a.marks_awarded) from exam_answers a where a.participant_id = ep.id and not a.auto_graded), 0)::numeric,
    (select count(*)::int from exam_answers a join quiz_questions q on q.id = a.question_id
      where a.participant_id = ep.id and q.type = 'written' and a.marks_awarded is null
        and (coalesce(trim(a.text_answer), '') <> '' or cardinality(a.image_paths) > 0)),
    (select coalesce(sum(q.marks), 0)::numeric from quiz_questions q where q.quiz_id = v_s.quiz_id and not q.is_hidden)
  from exam_participants ep
  where ep.session_id = p_session_id
  order by ep.display_name;
end;
$function$;

CREATE OR REPLACE FUNCTION public.issue_exam_certificate(p_participant_id uuid)
 RETURNS TABLE(id uuid, cert_number text, candidate_name text, quiz_title text, score_line text, template text, issued_at timestamp with time zone, company_name text, company_name_align text, cert_logo_url text, cert_logo_position text, cert_logo_scale integer, cert_watermark_type text, cert_watermark_text text, cert_watermark_image_url text, cert_title text, achievement_line text, signatory1_name text, signatory1_title text, signatory1_image_url text, signatory1_scale integer, signatory1_name_scale integer, signatory2_name text, signatory2_title text, signatory2_image_url text, signatory2_scale integer, signatory2_name_scale integer, signature_mode text, signature_align text, photo_enabled boolean, cert_photo_frame text, cert_award_seal text, candidate_photo_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company_id uuid;
  v_session_id uuid;
  v_finished timestamptz;
  v_quiz_title text;
  v_display_name text;
  v_pass_pct int;
  v_issue boolean;
  v_quiz_id uuid;
  v_total numeric;
  v_got numeric;
  v_pct int;
  v_row_id uuid;
  v_cert record;
  v_eligibility text;
  v_company_display_name text;
  v_rank int;
  v_pending int;
begin
  select es.company_id, es.id, es.finished_at, qz.title, ep.display_name, qz.passing_score_pct, qz.issue_certificate, qz.id
    into v_company_id, v_session_id, v_finished, v_quiz_title, v_display_name, v_pass_pct, v_issue, v_quiz_id
  from exam_participants ep
  join exam_sessions es on es.id = ep.session_id
  join quizzes qz on qz.id = es.quiz_id
  where ep.id = p_participant_id;

  if v_company_id is null then raise exception 'Participant not found.'; end if;
  if v_company_id <> current_quiz_admin_company_id() then raise exception 'Not authorized for this participant.'; end if;
  if v_finished is null then raise exception 'Certificates can be issued only after the exam has finished.'; end if;
  if not coalesce(v_issue, true) then raise exception 'This exam does not issue certificates.'; end if;

  select count(*)::int into v_pending
  from exam_answers a join quiz_questions q on q.id = a.question_id
  where a.participant_id = p_participant_id and q.type = 'written' and a.marks_awarded is null
    and (coalesce(trim(a.text_answer), '') <> '' or cardinality(a.image_paths) > 0);
  if v_pending > 0 then raise exception 'Mark the written answers first, then issue the certificate.'; end if;

  select coalesce(sum(q.marks), 0) into v_total from quiz_questions q where q.quiz_id = v_quiz_id and not q.is_hidden;
  select coalesce(sum(a.marks_awarded), 0) into v_got from exam_answers a where a.participant_id = p_participant_id;
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_got / v_total) end;
  if v_pct < v_pass_pct then raise exception 'Certificates are only issued for a passing score.'; end if;

  select c.company_name into v_company_display_name from companies c where c.id = v_company_id;
  select qs.cert_eligibility into v_eligibility from quiz_settings qs where qs.company_id = v_company_id;
  select * into v_cert from quiz_cert_templates t where t.company_id = v_company_id and t.is_active = true;

  select r.rnk into v_rank from (
    select ep2.id as pid, rank() over (order by coalesce((select sum(a.marks_awarded) from exam_answers a where a.participant_id = ep2.id), 0) desc) as rnk
    from exam_participants ep2 where ep2.session_id = v_session_id
  ) r where r.pid = p_participant_id;

  if coalesce(v_eligibility, 'all_pass') = 'top1' and v_rank > 1 then
    raise exception 'Certificates go to the top-ranked participant only.';
  elsif coalesce(v_eligibility, 'all_pass') = 'top3' and v_rank > 3 then
    raise exception 'Certificates go to the top 3 ranked participants only.';
  end if;

  select ec.id into v_row_id from exam_certificates ec where ec.participant_id = p_participant_id;
  if v_row_id is null then
    insert into exam_certificates (company_id, session_id, participant_id, cert_number, candidate_name, quiz_title, score_line, template)
    values (
      v_company_id, v_session_id, p_participant_id,
      'CERT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
      v_display_name, v_quiz_title, v_pct || '% — PASS',
      coalesce(v_cert.template, 'dark_elegant')
    )
    returning exam_certificates.id into v_row_id;
  end if;

  return query
  select
    ec.id, ec.cert_number, ec.candidate_name, ec.quiz_title, ec.score_line, ec.template, ec.issued_at,
    coalesce(v_cert.company_name, v_company_display_name, ''), coalesce(v_cert.company_name_align, 'center'),
    v_cert.logo_url, coalesce(v_cert.logo_position, 'top_center'), coalesce(v_cert.logo_scale, 100),
    coalesce(v_cert.watermark_type, 'none'), v_cert.watermark_text, v_cert.watermark_image_url,
    coalesce(v_cert.title, 'Certificate of Achievement'),
    coalesce(v_cert.achievement_line, 'has successfully completed'),
    v_cert.signatory1_name, v_cert.signatory1_title, v_cert.signatory1_image_url,
    coalesce(v_cert.signatory1_scale, 100), coalesce(v_cert.signatory1_name_scale, 100),
    v_cert.signatory2_name, v_cert.signatory2_title, v_cert.signatory2_image_url,
    coalesce(v_cert.signatory2_scale, 100), coalesce(v_cert.signatory2_name_scale, 100),
    coalesce(v_cert.signature_mode, 'both'), coalesce(v_cert.signature_align, 'center'),
    coalesce(v_cert.photo_enabled, false), coalesce(v_cert.photo_frame, 'circle'), coalesce(v_cert.award_seal, 'none'), ec.candidate_photo_url
  from exam_certificates ec where ec.id = v_row_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_quiz_answer(p_session_id uuid, p_question_id uuid, p_option_id uuid, p_response_time_ms integer)
 RETURNS TABLE(is_correct boolean, correct_option_id uuid, points_awarded integer, explanation text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_participant_id uuid;
  v_correct boolean := false;
  v_correct_option uuid;
  v_marks int;
  v_max_timer int;
  v_points int := 0;
  v_phase text;
  v_company_id uuid;
  v_explanation text;
begin
  select id into v_participant_id from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase, company_id into v_phase, v_company_id from quiz_sessions where id = p_session_id;
  if v_phase <> 'question' then
    raise exception 'This question is no longer accepting answers.';
  end if;

  if not quiz_module_enabled_for_company(v_company_id) then
    raise exception 'Live Quiz is not enabled for this company.';
  end if;

  select qo.id into v_correct_option from quiz_question_options qo
  where qo.question_id = p_question_id and qo.is_correct = true limit 1;

  if p_option_id is not null and p_option_id = v_correct_option then
    v_correct := true;
  end if;

  select qq.marks, coalesce(qq.timer_seconds, qz.default_timer_seconds), qq.explanation
    into v_marks, v_max_timer, v_explanation
  from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id
  where qq.id = p_question_id;

  if v_correct then
    v_points := v_marks * 1000 + greatest(0, round((1 - (p_response_time_ms::numeric / (v_max_timer * 1000))) * 500))::int;
  end if;

  insert into quiz_answers (session_id, participant_id, question_id, selected_option_id, is_correct, response_time_ms)
  values (p_session_id, v_participant_id, p_question_id, p_option_id, v_correct, p_response_time_ms)
  on conflict (participant_id, question_id) do nothing;

  if found then
    update quiz_participants
    set score = score + v_points,
        correct_count = correct_count + (case when v_correct then 1 else 0 end),
        total_response_time_ms = total_response_time_ms + p_response_time_ms
    where id = v_participant_id;
  end if;

  return query select v_correct, v_correct_option, v_points, v_explanation;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_quiz_hotspot_answer(p_session_id uuid, p_question_id uuid, p_click_x numeric, p_click_y numeric, p_response_time_ms integer)
 RETURNS TABLE(is_correct boolean, target_x numeric, target_y numeric, target_radius numeric, points_awarded integer, explanation text, hotspot_zones jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_participant_id uuid;
  v_correct boolean := false;
  v_target_x numeric;
  v_target_y numeric;
  v_target_radius numeric;
  v_zones jsonb;
  v_marks int;
  v_max_timer int;
  v_points int := 0;
  v_phase text;
  v_company_id uuid;
  v_explanation text;
begin
  select id into v_participant_id from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase, company_id into v_phase, v_company_id from quiz_sessions where id = p_session_id;
  if v_phase <> 'question' then
    raise exception 'This question is no longer accepting answers.';
  end if;

  if not quiz_module_enabled_for_company(v_company_id) then
    raise exception 'Live Quiz is not enabled for this company.';
  end if;

  select qq.target_x, qq.target_y, coalesce(qq.target_radius, 6), qq.hotspot_zones, qq.marks,
    coalesce(qq.timer_seconds, qz.default_timer_seconds), qq.explanation
    into v_target_x, v_target_y, v_target_radius, v_zones, v_marks, v_max_timer, v_explanation
  from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id
  where qq.id = p_question_id;

  if p_click_x is not null and p_click_y is not null then
    if v_zones is not null and jsonb_typeof(v_zones) = 'array' and jsonb_array_length(v_zones) > 0 then
      v_correct := hotspot_zone_hit(v_zones, p_click_x, p_click_y);
    elsif v_target_x is not null and v_target_y is not null then
      v_correct := sqrt(power(p_click_x - v_target_x, 2) + power(p_click_y - v_target_y, 2)) <= v_target_radius;
    end if;
  end if;

  if v_correct then
    v_points := v_marks * 1000 + greatest(0, round((1 - (p_response_time_ms::numeric / (v_max_timer * 1000))) * 500))::int;
  end if;

  insert into quiz_answers (session_id, participant_id, question_id, click_x, click_y, is_correct, response_time_ms)
  values (p_session_id, v_participant_id, p_question_id, p_click_x, p_click_y, v_correct, p_response_time_ms)
  on conflict (participant_id, question_id) do nothing;

  if found then
    update quiz_participants
    set score = score + v_points,
        correct_count = correct_count + (case when v_correct then 1 else 0 end),
        total_response_time_ms = total_response_time_ms + p_response_time_ms
    where id = v_participant_id;
  end if;

  return query select v_correct, v_target_x, v_target_y, v_target_radius, v_points, v_explanation, v_zones;
end;
$function$;

drop function if exists get_exam_session_settings(uuid);
drop function if exists admin_regrade_question(uuid, uuid, text);
drop function if exists reopen_exam_participant(uuid);
drop function if exists quiz_current_question_id(uuid, uuid);
drop table if exists exam_tap_checks;
