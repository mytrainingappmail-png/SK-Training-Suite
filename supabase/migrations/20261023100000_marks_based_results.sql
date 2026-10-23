-- ============================================================================
-- LIVE QUIZ RESULTS ARE NOW CALCULATED FROM MARKS, NOT FROM THE NUMBER OF QUESTIONS
--
-- Until now a Live Quiz result was "right answers / number of questions", as if every question were worth 1 mark.
-- A quiz with 145 questions of which 5 carry 2 marks (150 marks in all) was therefore graded out of 145.
-- Now: percentage = marks earned / total marks of the quiz (every question counts for its own marks).
-- When every question is worth 1 mark the result is exactly what it was before.
-- Exams were already marks-based and are not touched.
--
--   * quiz_participants.marks_earned: marks of the questions answered correctly, kept up to date by a trigger
--   * quiz_session_results: percent_correct, grade and rank now use marks; two new columns marks_obtained, total_marks
--   * get_my_result (the trainee's own result), issue_my_certificate and issue_certificate_for_participant
--     (pass mark and "top 1 / top 3" rank) use marks too
--   * existing results are recalculated from the saved answers
-- ============================================================================

-- null = unknown: older results whose answers were not kept cannot be re-marked, so they keep their old count-based result.
alter table public.quiz_participants add column if not exists marks_earned integer default 0;

create or replace function public.quiz_participant_refresh_marks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update quiz_participants p
     set marks_earned = coalesce((
           select sum(qq.marks)
             from quiz_answers a
             join quiz_questions qq on qq.id = a.question_id and not qq.is_hidden
            where a.participant_id = new.participant_id and a.is_correct
         ), 0)::int
   where p.id = new.participant_id;
  return null;
end;
$$;

drop trigger if exists trg_quiz_answers_marks on public.quiz_answers;
create trigger trg_quiz_answers_marks
  after insert or update of is_correct, question_id on public.quiz_answers
  for each row execute function public.quiz_participant_refresh_marks();

-- Recalculate what can be recalculated: a participant whose saved answers add up to their right-answer count gets exact marks;
-- one with no saved answers keeps zero (if they got nothing right) or "unknown" (null), so their old result is not changed.
update quiz_participants p
   set marks_earned = case
     when exists (select 1 from quiz_answers a where a.participant_id = p.id)
          and (select count(*) from quiz_answers a where a.participant_id = p.id and a.is_correct) = p.correct_count
       then coalesce((
              select sum(qq.marks)
                from quiz_answers a
                join quiz_questions qq on qq.id = a.question_id and not qq.is_hidden
               where a.participant_id = p.id and a.is_correct
            ), 0)::int
     when p.correct_count = 0 then 0
     else null
   end;

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
    rank() OVER (PARTITION BY qs.id ORDER BY COALESCE(qp.marks_earned, qp.correct_count) DESC, qp.total_response_time_ms) AS rank,
        CASE
            WHEN (CASE WHEN qp.marks_earned IS NULL THEN tm.total_q ELSE tm.total_marks END) = 0 THEN (0)::numeric
            ELSE round((100.0 * (COALESCE(qp.marks_earned, qp.correct_count))::numeric) / ((CASE WHEN qp.marks_earned IS NULL THEN tm.total_q ELSE tm.total_marks END))::numeric)
        END AS percent_correct,
        CASE
            WHEN (CASE WHEN qp.marks_earned IS NULL THEN tm.total_q ELSE tm.total_marks END) = 0 THEN 'FAIL'::text
            WHEN round((100.0 * (COALESCE(qp.marks_earned, qp.correct_count))::numeric) / ((CASE WHEN qp.marks_earned IS NULL THEN tm.total_q ELSE tm.total_marks END))::numeric) >= (qz.passing_score_pct)::numeric THEN 'PASS'::text
            WHEN round((100.0 * (COALESCE(qp.marks_earned, qp.correct_count))::numeric) / ((CASE WHEN qp.marks_earned IS NULL THEN tm.total_q ELSE tm.total_marks END))::numeric) >= (qz.improve_threshold_pct)::numeric THEN 'NEED_IMPROVEMENT'::text
            ELSE 'FAIL'::text
        END AS grade,
    qs.folder_id,
    qs.is_practice,
    qs.location_id,
    qp.marks_earned AS marks_obtained,
    tm.total_marks
   FROM quiz_sessions qs
     JOIN quizzes qz ON qz.id = qs.quiz_id
     JOIN quiz_participants qp ON qp.session_id = qs.id
     CROSS JOIN LATERAL ( SELECT (count(*))::integer AS total_q, (COALESCE(sum(qq.marks), 0))::integer AS total_marks
           FROM quiz_questions qq
          WHERE qq.quiz_id = qz.id AND NOT qq.is_hidden) tm;

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
  select qp.id, qs.company_id, qz.title, qp.display_name, coalesce(qp.marks_earned, qp.correct_count), qz.passing_score_pct, qz.issue_certificate
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

  select (case when exists (select 1 from quiz_participants qp3 where qp3.id = v_participant_id and qp3.marks_earned is null) then count(*) else coalesce(sum(marks), 0) end)::int into v_total from quiz_questions where quiz_id = (select qs2.quiz_id from quiz_sessions qs2 where qs2.id = p_session_id) and not is_hidden;
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_correct / v_total) end;

  if v_pct < v_pass_pct then
    raise exception 'Certificates are only issued for a passing score.';
  end if;

  select c.company_name into v_company_display_name from companies c where c.id = v_company_id;
  select cert_eligibility into v_eligibility from quiz_settings where company_id = v_company_id;
  select * into v_cert from quiz_cert_templates where company_id = v_company_id and is_active = true;

  select r.rnk into v_rank from (
    select qp2.id, rank() over (order by coalesce(qp2.marks_earned, qp2.correct_count) desc, qp2.total_response_time_ms asc) as rnk
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
  select qs.company_id, qp.session_id, qz.title, qp.display_name, coalesce(qp.marks_earned, qp.correct_count), qz.passing_score_pct, qz.issue_certificate
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

  select (case when exists (select 1 from quiz_participants qp3 where qp3.id = p_participant_id and qp3.marks_earned is null) then count(*) else coalesce(sum(marks), 0) end)::int into v_total from quiz_questions where quiz_id = (select qs2.quiz_id from quiz_sessions qs2 where qs2.id = v_session_id) and not is_hidden;
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_correct / v_total) end;

  if v_pct < v_pass_pct then
    raise exception 'Certificates are only issued for a passing score.';
  end if;

  select c.company_name into v_company_display_name from companies c where c.id = v_company_id;
  select cert_eligibility into v_eligibility from quiz_settings where company_id = v_company_id;
  select * into v_cert from quiz_cert_templates where company_id = v_company_id and is_active = true;

  select r.rnk into v_rank from (
    select qp2.id, rank() over (order by coalesce(qp2.marks_earned, qp2.correct_count) desc, qp2.total_response_time_ms asc) as rnk
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

drop function if exists public.get_my_result(uuid);

create function public.get_my_result(p_session_id uuid)
 returns table(correct_count integer, total_questions integer, percent_correct integer, grade text, marks_obtained integer, total_marks integer)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_correct int;
  v_marks int;
  v_pass_pct int;
  v_improve_pct int;
  v_total int;
  v_total_marks int;
  v_pct int;
begin
  select qp.correct_count, qp.marks_earned, qz.passing_score_pct, qz.improve_threshold_pct
    into v_correct, v_marks, v_pass_pct, v_improve_pct
  from quiz_participants qp
  join quiz_sessions qs on qs.id = qp.session_id
  join quizzes qz on qz.id = qs.quiz_id
  where qp.session_id = p_session_id and qp.auth_user_id = auth.uid();

  if v_correct is null then
    raise exception 'Not a participant in this session.';
  end if;

  select count(*), coalesce(sum(marks), 0)::int into v_total, v_total_marks
    from quiz_questions
   where quiz_id = (select qs2.quiz_id from quiz_sessions qs2 where qs2.id = p_session_id) and not is_hidden;
  -- marks unknown (older result without saved answers): the old count-based percentage
  v_pct := case
    when v_marks is null then case when v_total = 0 then 0 else round(100.0 * v_correct / v_total) end
    when v_total_marks = 0 then 0
    else round(100.0 * v_marks / v_total_marks)
  end;

  return query select
    v_correct, v_total, v_pct,
    case
      when v_pct >= v_pass_pct then 'PASS'
      when v_pct >= v_improve_pct then 'NEED_IMPROVEMENT'
      else 'FAIL'
    end,
    v_marks, v_total_marks;
end;
$function$;

revoke all on function public.get_my_result(uuid) from public, anon;
grant execute on function public.get_my_result(uuid) to authenticated;
