-- ============================================================================
-- PRACTICE RUNS
--
-- A trainer can run any Live Quiz or Exam as a PRACTICE: it plays exactly like the real thing for the employees,
-- but nothing is kept.
--   * no certificate is ever issued
--   * questions / options are never shuffled (everyone sees the same order)
--   * right / wrong is shown straight away
--   * it never shows in Results, Dashboard, Final Result, Batch Records or the Recycle Bin
--   * it is deleted ~10 minutes after the trainer presses Back (or 24 hours after it started if they never do)
-- Nothing about the quiz / exam itself is changed: "practice" belongs to the one run only.
-- ============================================================================

alter table quiz_sessions add column if not exists is_practice boolean not null default false;
alter table quiz_sessions add column if not exists practice_purge_at timestamptz;
alter table exam_sessions add column if not exists is_practice boolean not null default false;
alter table exam_sessions add column if not exists practice_purge_at timestamptz;

create or replace view quiz_session_results as
SELECT qs.id AS session_id,
    qs.quiz_id,
    qs.company_id,
    qz.title AS quiz_title,
    qz.passing_score_pct,
    qz.improve_threshold_pct,
    qs.started_at,
    qs.ended_at,
    ( SELECT count(*) AS count
           FROM quiz_questions qq
          WHERE ((qq.quiz_id = qz.id) AND (NOT qq.is_hidden))) AS total_questions,
    qp.id AS participant_id,
    qp.display_name,
    qp.score,
    qp.correct_count,
    qp.total_response_time_ms,
    rank() OVER (PARTITION BY qs.id ORDER BY qp.correct_count DESC, qp.total_response_time_ms) AS rank,
        CASE
            WHEN (( SELECT count(*) AS count
               FROM quiz_questions qq
              WHERE ((qq.quiz_id = qz.id) AND (NOT qq.is_hidden))) = 0) THEN (0)::numeric
            ELSE round(((100.0 * (qp.correct_count)::numeric) / (( SELECT count(*) AS count
               FROM quiz_questions qq
              WHERE ((qq.quiz_id = qz.id) AND (NOT qq.is_hidden))))::numeric))
        END AS percent_correct,
        CASE
            WHEN (( SELECT count(*) AS count
               FROM quiz_questions qq
              WHERE ((qq.quiz_id = qz.id) AND (NOT qq.is_hidden))) = 0) THEN 'FAIL'::text
            WHEN (round(((100.0 * (qp.correct_count)::numeric) / (( SELECT count(*) AS count
               FROM quiz_questions qq
              WHERE ((qq.quiz_id = qz.id) AND (NOT qq.is_hidden))))::numeric)) >= (qz.passing_score_pct)::numeric) THEN 'PASS'::text
            WHEN (round(((100.0 * (qp.correct_count)::numeric) / (( SELECT count(*) AS count
               FROM quiz_questions qq
              WHERE ((qq.quiz_id = qz.id) AND (NOT qq.is_hidden))))::numeric)) >= (qz.improve_threshold_pct)::numeric) THEN 'NEED_IMPROVEMENT'::text
            ELSE 'FAIL'::text
        END AS grade,
    qs.folder_id,
    qs.is_practice
   FROM ((quiz_sessions qs
     JOIN quizzes qz ON ((qz.id = qs.quiz_id)))
     JOIN quiz_participants qp ON ((qp.session_id = qs.id)));

CREATE OR REPLACE FUNCTION public.recycle_quiz_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_title text;
begin
  if old.is_practice then return old; end if;
  select title into v_title from quizzes where id = old.quiz_id;
  -- deleted together with its quiz: the quiz is already in the bin, take the name from there
  if v_title is null then
    select rb.title into v_title from recycle_bin rb where rb.entity_type = 'quiz' and rb.entity_id = old.quiz_id order by rb.deleted_at desc limit 1;
  end if;
  insert into recycle_bin (company_id, entity_type, entity_id, title, subtitle, payload, deleted_by)
  values (
    old.company_id, 'quiz_session', old.id, coalesce(v_title, 'Quiz session'),
    'Live quiz results · ' || to_char(coalesce(old.ended_at, old.created_at), 'DD Mon YYYY'),
    jsonb_build_object(
      'session', to_jsonb(old),
      'participants', coalesce((select jsonb_agg(to_jsonb(p)) from quiz_participants p where p.session_id = old.id), '[]'::jsonb),
      'answers', coalesce((select jsonb_agg(to_jsonb(a)) from quiz_answers a where a.session_id = old.id), '[]'::jsonb)
    ),
    auth.uid()
  );
  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION public.recycle_exam_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_title text;
begin
  if old.is_practice then return old; end if;
  select title into v_title from quizzes where id = old.quiz_id;
  if v_title is null then
    select rb.title into v_title from recycle_bin rb where rb.entity_type = 'quiz' and rb.entity_id = old.quiz_id order by rb.deleted_at desc limit 1;
  end if;
  insert into recycle_bin (company_id, entity_type, entity_id, title, subtitle, payload, deleted_by)
  values (
    old.company_id, 'exam_session', old.id, coalesce(v_title, 'Exam session'),
    'Exam results · ' || to_char(old.created_at, 'DD Mon YYYY'),
    jsonb_build_object(
      'session', to_jsonb(old),
      'participants', coalesce((select jsonb_agg(to_jsonb(p)) from exam_participants p where p.session_id = old.id), '[]'::jsonb),
      'answers', coalesce((select jsonb_agg(to_jsonb(a)) from exam_answers a where a.participant_id in (select id from exam_participants where session_id = old.id)), '[]'::jsonb)
    ),
    auth.uid()
  );
  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION public.issue_my_certificate(p_session_id uuid)
 RETURNS TABLE(id uuid, cert_number text, candidate_name text, quiz_title text, score_line text, template text, issued_at timestamp with time zone, company_name text, company_name_align text, cert_logo_url text, cert_logo_position text, cert_logo_scale integer, cert_watermark_type text, cert_watermark_text text, cert_watermark_image_url text, cert_title text, achievement_line text, signatory1_name text, signatory1_title text, signatory1_image_url text, signatory1_scale integer, signatory1_name_scale integer, signatory2_name text, signatory2_title text, signatory2_image_url text, signatory2_scale integer, signatory2_name_scale integer, signature_mode text, signature_align text, photo_enabled boolean, cert_photo_frame text, cert_award_seal text, candidate_photo_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_participant_id uuid;
  v_company_id uuid;
  v_quiz_title text;
  v_display_name text;
  v_correct int;
  v_pass_pct int;
  v_total int;
  v_pct int;
  v_row_id uuid;
  v_cert record;
  v_eligibility text;
  v_company_display_name text;
  v_rank int;
  v_issue_certificate boolean;
begin
  if exists (select 1 from quiz_sessions ps where ps.id = p_session_id and ps.is_practice) then
    raise exception 'A practice run does not issue certificates.';
  end if;
  select qp.id, qs.company_id, qz.title, qp.display_name, qp.correct_count, qz.passing_score_pct, qz.issue_certificate
    into v_participant_id, v_company_id, v_quiz_title, v_display_name, v_correct, v_pass_pct, v_issue_certificate
  from quiz_participants qp
  join quiz_sessions qs on qs.id = qp.session_id
  join quizzes qz on qz.id = qs.quiz_id
  where qp.session_id = p_session_id and qp.auth_user_id = auth.uid();

  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  if not coalesce(v_issue_certificate, true) then
    raise exception 'This quiz does not issue certificates.';
  end if;

  select count(*) into v_total from quiz_questions where quiz_id = (select qs2.quiz_id from quiz_sessions qs2 where qs2.id = p_session_id) and not is_hidden;
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_correct / v_total) end;

  if v_pct < v_pass_pct then
    raise exception 'Certificates are only issued for a passing score.';
  end if;

  select c.company_name into v_company_display_name from companies c where c.id = v_company_id;
  select cert_eligibility into v_eligibility from quiz_settings where company_id = v_company_id;
  select * into v_cert from quiz_cert_templates where company_id = v_company_id and is_active = true;

  select r.rnk into v_rank from (
    select qp2.id, rank() over (order by qp2.correct_count desc, qp2.total_response_time_ms asc) as rnk
    from quiz_participants qp2 where qp2.session_id = p_session_id
  ) r where r.id = v_participant_id;

  if coalesce(v_eligibility, 'all_pass') = 'top1' and v_rank > 1 then
    raise exception 'Certificates go to the top-ranked participant only for this quiz.';
  elsif coalesce(v_eligibility, 'all_pass') = 'top3' and v_rank > 3 then
    raise exception 'Certificates go to the top 3 ranked participants for this quiz.';
  end if;

  select qc.id into v_row_id from quiz_certificates qc where qc.participant_id = v_participant_id;
  if v_row_id is null then
    insert into quiz_certificates (company_id, session_id, participant_id, cert_number, candidate_name, quiz_title, score_line, template)
    values (
      v_company_id, p_session_id, v_participant_id,
      'CERT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
      v_display_name, v_quiz_title, v_pct || '% — PASS',
      coalesce(v_cert.template, 'dark_elegant')
    )
    returning quiz_certificates.id into v_row_id;
  end if;

  return query
  select
    qc.id, qc.cert_number, qc.candidate_name, qc.quiz_title, qc.score_line, qc.template, qc.issued_at,
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
    coalesce(v_cert.photo_enabled, false), coalesce(v_cert.photo_frame, 'circle'), coalesce(v_cert.award_seal, 'none'), qc.candidate_photo_url
  from quiz_certificates qc where qc.id = v_row_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.issue_certificate_for_participant(p_participant_id uuid)
 RETURNS TABLE(id uuid, cert_number text, candidate_name text, quiz_title text, score_line text, template text, issued_at timestamp with time zone, company_name text, company_name_align text, cert_logo_url text, cert_logo_position text, cert_logo_scale integer, cert_watermark_type text, cert_watermark_text text, cert_watermark_image_url text, cert_title text, achievement_line text, signatory1_name text, signatory1_title text, signatory1_image_url text, signatory1_scale integer, signatory1_name_scale integer, signatory2_name text, signatory2_title text, signatory2_image_url text, signatory2_scale integer, signatory2_name_scale integer, signature_mode text, signature_align text, photo_enabled boolean, cert_photo_frame text, cert_award_seal text, candidate_photo_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company_id uuid;
  v_session_id uuid;
  v_quiz_title text;
  v_display_name text;
  v_correct int;
  v_pass_pct int;
  v_total int;
  v_pct int;
  v_row_id uuid;
  v_cert record;
  v_eligibility text;
  v_company_display_name text;
  v_rank int;
  v_issue_certificate boolean;
begin
  if exists (select 1 from quiz_participants pp join quiz_sessions ps on ps.id = pp.session_id where pp.id = p_participant_id and ps.is_practice) then
    raise exception 'A practice run does not issue certificates.';
  end if;
  select qs.company_id, qp.session_id, qz.title, qp.display_name, qp.correct_count, qz.passing_score_pct, qz.issue_certificate
    into v_company_id, v_session_id, v_quiz_title, v_display_name, v_correct, v_pass_pct, v_issue_certificate
  from quiz_participants qp
  join quiz_sessions qs on qs.id = qp.session_id
  join quizzes qz on qz.id = qs.quiz_id
  where qp.id = p_participant_id;

  if v_company_id is null then
    raise exception 'Participant not found.';
  end if;
  if v_company_id <> current_quiz_admin_company_id() then
    raise exception 'Not authorized for this participant.';
  end if;

  if not coalesce(v_issue_certificate, true) then
    raise exception 'This quiz does not issue certificates.';
  end if;

  select count(*) into v_total from quiz_questions where quiz_id = (select qs2.quiz_id from quiz_sessions qs2 where qs2.id = v_session_id) and not is_hidden;
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_correct / v_total) end;

  if v_pct < v_pass_pct then
    raise exception 'Certificates are only issued for a passing score.';
  end if;

  select c.company_name into v_company_display_name from companies c where c.id = v_company_id;
  select cert_eligibility into v_eligibility from quiz_settings where company_id = v_company_id;
  select * into v_cert from quiz_cert_templates where company_id = v_company_id and is_active = true;

  select r.rnk into v_rank from (
    select qp2.id, rank() over (order by qp2.correct_count desc, qp2.total_response_time_ms asc) as rnk
    from quiz_participants qp2 where qp2.session_id = v_session_id
  ) r where r.id = p_participant_id;

  if coalesce(v_eligibility, 'all_pass') = 'top1' and v_rank > 1 then
    raise exception 'Certificates go to the top-ranked participant only for this quiz.';
  elsif coalesce(v_eligibility, 'all_pass') = 'top3' and v_rank > 3 then
    raise exception 'Certificates go to the top 3 ranked participants for this quiz.';
  end if;

  select qc.id into v_row_id from quiz_certificates qc where qc.participant_id = p_participant_id;
  if v_row_id is null then
    insert into quiz_certificates (company_id, session_id, participant_id, cert_number, candidate_name, quiz_title, score_line, template)
    values (
      v_company_id, v_session_id, p_participant_id,
      'CERT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
      v_display_name, v_quiz_title, v_pct || '% — PASS',
      coalesce(v_cert.template, 'dark_elegant')
    )
    returning quiz_certificates.id into v_row_id;
  end if;

  return query
  select
    qc.id, qc.cert_number, qc.candidate_name, qc.quiz_title, qc.score_line, qc.template, qc.issued_at,
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
    coalesce(v_cert.photo_enabled, false), coalesce(v_cert.photo_frame, 'circle'), coalesce(v_cert.award_seal, 'none'), qc.candidate_photo_url
  from quiz_certificates qc where qc.id = v_row_id;
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
  if exists (select 1 from exam_participants pp join exam_sessions ps on ps.id = pp.session_id where pp.id = p_participant_id and ps.is_practice) then
    raise exception 'A practice run does not issue certificates.';
  end if;
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
  select coalesce(sum(a.marks_awarded), 0) into v_got from exam_answers a join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = p_participant_id;
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_got / v_total) end;
  if v_pct < v_pass_pct then raise exception 'Certificates are only issued for a passing score.'; end if;

  select c.company_name into v_company_display_name from companies c where c.id = v_company_id;
  select qs.cert_eligibility into v_eligibility from quiz_settings qs where qs.company_id = v_company_id;
  select * into v_cert from quiz_cert_templates t where t.company_id = v_company_id and t.is_active = true;

  select r.rnk into v_rank from (
    select ep2.id as pid, rank() over (order by coalesce((select sum(a.marks_awarded) from exam_answers a join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = ep2.id), 0) desc) as rnk
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

CREATE OR REPLACE FUNCTION public.quiz_current_question_id(p_session_id uuid, p_participant_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_quiz uuid;
  v_idx int;
  v_order uuid[];
  v_shuffle boolean;
  v_qid uuid;
begin
  select quiz_id, current_question_index, question_order into v_quiz, v_idx, v_order
  from quiz_sessions where id = p_session_id and phase = 'question';
  if v_quiz is null then return null; end if;
  select e.idx into v_idx from quiz_effective_position(p_session_id, p_participant_id) e;

  select coalesce(shuffle_questions_per_participant, false) and not coalesce((select ps.is_practice from quiz_sessions ps where ps.id = p_session_id), false) into v_shuffle from quizzes where id = v_quiz;

  if v_shuffle then
    select qq.id into v_qid from quiz_questions qq
    where qq.quiz_id = v_quiz and not qq.is_hidden
    order by md5(qq.id::text || p_participant_id::text)
    offset v_idx limit 1;
  elsif v_order is not null and v_idx < array_length(v_order, 1) then
    v_qid := v_order[v_idx + 1];
  else
    select qq.id into v_qid from quiz_questions qq
    where qq.quiz_id = v_quiz and not qq.is_hidden order by qq.display_order limit 1 offset v_idx;
  end if;
  return v_qid;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_quiz_question(p_session_id uuid)
 RETURNS TABLE(question_id uuid, question_text text, type text, timer_seconds integer, question_index integer, total_questions integer, option_id uuid, option_text text, option_order integer, image_url text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_participant_id uuid;
  v_quiz_id uuid;
  v_company_id uuid;
  v_idx int;
  v_qid uuid;
  v_order uuid[];
  v_shuffle_options boolean;
  v_shuffle_per_participant boolean;
begin
  select id into v_participant_id
  from quiz_participants where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select quiz_id, company_id, current_question_index, question_order
    into v_quiz_id, v_company_id, v_idx, v_order
  from quiz_sessions where id = p_session_id and phase = 'question';
  if v_quiz_id is null then
    return;
  end if;
  select e.idx into v_idx from quiz_effective_position(p_session_id, v_participant_id) e;

  if not quiz_module_enabled_for_company(v_company_id) then
    raise exception 'Live Quiz is not enabled for this company.';
  end if;

  select shuffle_options and not coalesce((select ps.is_practice from quiz_sessions ps where ps.id = p_session_id), false), coalesce(shuffle_questions_per_participant, false) and not coalesce((select ps.is_practice from quiz_sessions ps where ps.id = p_session_id), false)
    into v_shuffle_options, v_shuffle_per_participant
  from quizzes where id = v_quiz_id;

  if v_shuffle_per_participant then
    -- Same technique already used for per-participant option shuffling —
    -- a stable hash of (question id, participant id) as the sort key gives
    -- each participant their own consistent-across-refreshes but
    -- different-from-everyone-else ordering of the same question set.
    select qq.id into v_qid from quiz_questions qq
    where qq.quiz_id = v_quiz_id and not qq.is_hidden
    order by md5(qq.id::text || v_participant_id::text)
    offset v_idx limit 1;
  elsif v_order is not null and v_idx < array_length(v_order, 1) then
    v_qid := v_order[v_idx + 1]; -- postgres arrays are 1-indexed
  else
    -- Defensive fallback only — the client always builds question_order
    -- pre-filtered to visible questions at launch, so this path is not
    -- expected to run in practice, but stays consistent if it ever does.
    select qq.id into v_qid from quiz_questions qq
    where qq.quiz_id = v_quiz_id and not qq.is_hidden order by qq.display_order limit 1 offset v_idx;
  end if;

  if v_qid is null then
    return;
  end if;

  return query
  select
    qq.id, qq.question_text, qq.type, coalesce((select q2.timer_seconds from quiz_questions q2 where q2.id = v_order[v_idx + 1]), qq.timer_seconds, qz.default_timer_seconds),
    v_idx, coalesce(array_length(v_order, 1), (select count(*) from quiz_questions where quiz_id = v_quiz_id and not is_hidden)::int),
    qo.id, qo.option_text,
    (case when v_shuffle_options
      then row_number() over (order by md5(qo.id::text || v_participant_id::text))
      else row_number() over (order by qo.display_order)
    end)::int as option_order,
    qq.image_url
  from quiz_questions qq
  join quizzes qz on qz.id = qq.quiz_id
  left join quiz_question_options qo on qo.question_id = qq.id
  where qq.id = v_qid
  order by option_order;
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

  select coalesce(qz.shuffle_questions_per_participant, false) and not v_s.is_practice, coalesce(qz.shuffle_options, false) and not v_s.is_practice
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
    case when v_s.reveal_answers then a.is_correct end
  from qs
  left join quiz_question_options o on o.question_id = qs.id
  left join exam_answers a on a.question_id = qs.id and a.participant_id = v_pid
  order by qs.pos, 9;
end;
$function$;

drop function if exists public.create_exam_session(uuid, integer, integer, timestamp with time zone);
CREATE OR REPLACE FUNCTION public.create_exam_session(p_quiz_id uuid, p_duration_seconds integer, p_start_in_seconds integer DEFAULT NULL::integer, p_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_practice boolean DEFAULT false)
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
  v_reveal boolean;
  v_fb_seconds integer;
  v_fb_size text;
  i int;
begin
  select qz.company_id, qz.mode, qz.status, qz.reveal_answers into v_quiz from quizzes qz where qz.id = p_quiz_id;
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

  -- Freeze this exam's answer-reveal behaviour now, from ITS company's settings,
  -- so a later settings change never alters an exam already scheduled/running.
  select coalesce(s.exam_reveal_answers, true), coalesce(s.exam_hotspot_feedback_seconds, 3), coalesce(s.exam_hotspot_feedback_size, 'small')
    into v_reveal, v_fb_seconds, v_fb_size
  from (select 1) one left join quiz_settings s on s.company_id = v_quiz.company_id;

  -- This exam's own choice (set in the exam builder) wins over the company default.
  if v_quiz.reveal_answers is not null then v_reveal := v_quiz.reveal_answers; end if;

  for i in 1 .. 8 loop
    v_pin := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
    begin
      insert into exam_sessions (quiz_id, company_id, host_admin_id, pin, duration_seconds, opens_at, deadline_at,
                                 reveal_answers, hotspot_feedback_seconds, hotspot_feedback_size, is_practice)
      values (p_quiz_id, v_quiz.company_id,
        (select qa.id from quiz_admins qa where qa.auth_user_id = auth.uid() limit 1),
        v_pin, p_duration_seconds, v_opens, v_opens + make_interval(secs => p_duration_seconds),
        case when p_practice then true else coalesce(v_reveal, true) end, coalesce(v_fb_seconds, 3), coalesce(v_fb_size, 'small'), p_practice)
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
revoke all on function public.create_exam_session(uuid, integer, integer, timestamp with time zone, boolean) from public, anon;
grant execute on function public.create_exam_session(uuid, integer, integer, timestamp with time zone, boolean) to authenticated;


-- The trainer pressed Back on a practice run: end it if it is still going, and schedule it for deletion
-- (a few minutes later, so employees still on their result screen are not cut off).
create or replace function public.practice_leave(p_kind text, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind = 'quiz' then
    update quiz_sessions
       set phase = 'ended', ended_at = coalesce(ended_at, now()), practice_purge_at = now() + interval '10 minutes'
     where id = p_session_id and is_practice
       and company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit();
    if not found then raise exception 'Practice session not found or not authorized.'; end if;
  elsif p_kind = 'exam' then
    if not exists (select 1 from exam_sessions s where s.id = p_session_id and s.is_practice
        and s.company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit()) then
      raise exception 'Practice session not found or not authorized.';
    end if;
    if exists (select 1 from exam_sessions s where s.id = p_session_id and s.finished_at is null) then
      perform exam_finalize_session(p_session_id, 'ended_by_admin');
    end if;
    update exam_sessions set practice_purge_at = now() + interval '10 minutes' where id = p_session_id;
  else
    raise exception 'Unknown kind.';
  end if;
end;
$$;

-- Deletes this company's practice runs that are due (left by the trainer, or older than a day). Cheap; called from the admin lists.
create or replace function public.purge_practice_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := current_quiz_admin_company_id();
  n integer := 0;
  m integer := 0;
begin
  if v_company is null then return 0; end if;
  delete from quiz_sessions
   where is_practice and company_id = v_company
     and coalesce(practice_purge_at, created_at + interval '24 hours') <= now();
  get diagnostics n = row_count;
  delete from exam_sessions
   where is_practice and company_id = v_company
     and coalesce(practice_purge_at, deadline_at + interval '24 hours') <= now();
  get diagnostics m = row_count;
  return n + m;
end;
$$;

revoke all on function public.practice_leave(text, uuid) from public, anon;
revoke all on function public.purge_practice_sessions() from public, anon;
grant execute on function public.practice_leave(text, uuid) to authenticated;
grant execute on function public.purge_practice_sessions() to authenticated;

insert into help_articles (category, title, display_order, keywords, content_html)
select 'live_quiz', 'Running a Practice Quiz or Exam', 10, 'practice, trial, rehearsal, dry run, test run, no result, no certificate, delete result',
$art$<p>Use <strong>Practice</strong> to let employees try a quiz or exam before the real one — <strong>nothing is saved</strong>, so there is nothing to delete afterwards.</p>
<h2>How to start</h2>
<p>On the Quizzes or Exams list press <strong>Practice</strong> instead of Launch / Start. You do not have to change any setting.</p>
<h2>What a practice run does</h2>
<ul>
<li>Plays exactly like the real thing for employees — they see their score and right/wrong answers as usual.</li>
<li>Right / wrong is always shown, questions and options are <strong>not shuffled</strong>, and <strong>no certificate</strong> is issued.</li>
<li>You see the live results on your screen. They never appear in Results, Dashboard, Final Result or Batch Records, and not in the Recycle Bin either.</li>
<li>When you press <strong>Back</strong>, the practice is closed and deleted a few minutes later (so employees on their result screen are not cut off). If you forget, it is deleted automatically after 24 hours.</li>
</ul>
<p>The quiz or exam itself is not changed, so the real run after the practice uses its normal settings.</p>$art$
where not exists (select 1 from help_articles where title = 'Running a Practice Quiz or Exam');
