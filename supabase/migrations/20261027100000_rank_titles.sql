-- ============================================================================
-- TOP-RANK TITLES
--
-- Until now a trainee who passed was simply labelled PASS. Now the three best results of a session get their own title:
--   rank 1  🏆 TOPPER      rank 2  🥈 2nd RANK      rank 3  🥉 3rd RANK        (everybody else who passed is still PASS)
-- shown on the results, on the trainee's own result screen and on the certificate (its heading, its "has secured ..." line
-- and the score line). Every word is editable by the trainer in Quiz Settings -> Top Rank Titles, and the whole thing can be
-- switched off. Open-link attempts (one trainee per session) have no ranking, so they never get a title.
-- ============================================================================

-- the suggested wording lives here (data, not code): new companies start with it, "reset" in Settings brings it back
create or replace function public.default_rank_titles()
returns jsonb language sql immutable
as $$ select '[{"badge":"🏆 TOPPER","title":"🏆 You are the Topper!","message":"Rank #1 — the highest score in the room. Outstanding performance!","cert_title":"Certificate of Excellence","cert_line":"has secured the 1st Rank (Topper) in","cert_score":"Rank 1 · TOPPER"},{"badge":"🥈 2nd RANK","title":"🥈 Second Rank!","message":"Rank #2 — brilliant work, just one step away from the top!","cert_title":"Certificate of Distinction","cert_line":"has secured the 2nd Rank in","cert_score":"Rank 2 · RUNNER-UP"},{"badge":"🥉 3rd RANK","title":"🥉 Third Rank!","message":"Rank #3 — a superb result, well deserved!","cert_title":"Certificate of Merit","cert_line":"has secured the 3rd Rank in","cert_score":"Rank 3 · SECOND RUNNER-UP"}]'::jsonb $$;
revoke all on function public.default_rank_titles() from public, anon;
grant execute on function public.default_rank_titles() to authenticated;

alter table public.quiz_settings add column if not exists rank_titles_enabled boolean not null default true;
alter table public.quiz_settings add column if not exists rank_titles jsonb not null default public.default_rank_titles();
alter table public.quiz_settings alter column rank_titles set default public.default_rank_titles();

alter table public.quiz_certificates add column if not exists rank_no integer;
alter table public.quiz_certificates add column if not exists title_override text;
alter table public.quiz_certificates add column if not exists achievement_override text;
alter table public.exam_certificates add column if not exists rank_no integer;
alter table public.exam_certificates add column if not exists title_override text;
alter table public.exam_certificates add column if not exists achievement_override text;

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
            WHEN (
            CASE
                WHEN (qp.marks_earned IS NULL) THEN tm.total_q
                ELSE tm.total_marks
            END = 0) THEN (0)::numeric
            ELSE round(((100.0 * (COALESCE(qp.marks_earned, qp.correct_count))::numeric) / (
            CASE
                WHEN (qp.marks_earned IS NULL) THEN tm.total_q
                ELSE tm.total_marks
            END)::numeric))
        END AS percent_correct,
        CASE
            WHEN (
            CASE
                WHEN (qp.marks_earned IS NULL) THEN tm.total_q
                ELSE tm.total_marks
            END = 0) THEN 'FAIL'::text
            WHEN (round(((100.0 * (COALESCE(qp.marks_earned, qp.correct_count))::numeric) / (
            CASE
                WHEN (qp.marks_earned IS NULL) THEN tm.total_q
                ELSE tm.total_marks
            END)::numeric)) >= (qz.passing_score_pct)::numeric) THEN 'PASS'::text
            WHEN (round(((100.0 * (COALESCE(qp.marks_earned, qp.correct_count))::numeric) / (
            CASE
                WHEN (qp.marks_earned IS NULL) THEN tm.total_q
                ELSE tm.total_marks
            END)::numeric)) >= (qz.improve_threshold_pct)::numeric) THEN 'NEED_IMPROVEMENT'::text
            ELSE 'FAIL'::text
        END AS grade,
    qs.folder_id,
    qs.is_practice,
    qs.location_id,
    qp.marks_earned AS marks_obtained,
    tm.total_marks,
    qs.open_link_id
   FROM (((quiz_sessions qs
     JOIN quizzes qz ON ((qz.id = qs.quiz_id)))
     JOIN quiz_participants qp ON ((qp.session_id = qs.id)))
     CROSS JOIN LATERAL ( SELECT (count(*))::integer AS total_q,
            (COALESCE(sum(qq.marks), (0)::bigint))::integer AS total_marks
           FROM quiz_questions qq
          WHERE ((qq.quiz_id = qz.id) AND (NOT qq.is_hidden))) tm);

CREATE OR REPLACE FUNCTION public.issue_my_certificate(p_session_id uuid)
 RETURNS TABLE(id uuid, cert_number text, candidate_name text, quiz_title text, score_line text, template text, issued_at timestamp with time zone, company_name text, company_name_align text, cert_logo_url text, cert_logo_position text, cert_logo_scale integer, cert_watermark_type text, cert_watermark_text text, cert_watermark_image_url text, cert_title text, achievement_line text, signatory1_name text, signatory1_title text, signatory1_image_url text, signatory1_scale integer, signatory1_name_scale integer, signatory2_name text, signatory2_title text, signatory2_image_url text, signatory2_scale integer, signatory2_name_scale integer, signature_mode text, signature_align text, photo_enabled boolean, cert_photo_frame text, cert_award_seal text, candidate_photo_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_rank_no int;
  v_ttl text;
  v_line text;
  v_tail text := 'PASS';
  v_rt jsonb;
  v_rts jsonb;
  v_rt_on boolean;
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

  v_rt_on := null; v_rt := null;
  select s.rank_titles_enabled, s.rank_titles into v_rt_on, v_rts from quiz_settings s where s.company_id = v_company_id;
  if not found then v_rt_on := true; v_rts := public.default_rank_titles(); end if;
  v_rt := v_rts -> (v_rank - 1);
  if coalesce(v_rt_on, false) and v_rank between 1 and 3 and v_rt is not null and jsonb_typeof(v_rt) = 'object' and not exists (select 1 from quiz_sessions os where os.id = p_session_id and os.open_link_id is not null) then
    v_rank_no := v_rank;
    v_ttl := nullif(btrim(v_rt->>'cert_title'), '');
    v_line := nullif(btrim(v_rt->>'cert_line'), '');
    v_tail := coalesce(nullif(btrim(v_rt->>'cert_score'), ''), 'PASS');
  end if;

  select qc.id into v_row_id from quiz_certificates qc where qc.participant_id = v_participant_id;
  if v_row_id is null then
    insert into quiz_certificates (company_id, session_id, participant_id, cert_number, candidate_name, quiz_title, score_line, template, rank_no, title_override, achievement_override)
    values (
      v_company_id, p_session_id, v_participant_id,
      'CERT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
      v_display_name, v_quiz_title, v_pct || '% — ' || v_tail,
      coalesce(v_cert.template, 'dark_elegant'), v_rank_no, v_ttl, v_line
    )
    returning quiz_certificates.id into v_row_id;
  end if;

  return query
  select
    qc.id, qc.cert_number, qc.candidate_name, qc.quiz_title, qc.score_line, qc.template, qc.issued_at,
    coalesce(v_cert.company_name, v_company_display_name, ''), coalesce(v_cert.company_name_align, 'center'),
    v_cert.logo_url, coalesce(v_cert.logo_position, 'top_center'), coalesce(v_cert.logo_scale, 100),
    coalesce(v_cert.watermark_type, 'none'), v_cert.watermark_text, v_cert.watermark_image_url,
    coalesce(qc.title_override, v_cert.title, 'Certificate of Achievement'),
    coalesce(qc.achievement_override, v_cert.achievement_line, 'has successfully completed'),
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
  v_rank_no int;
  v_ttl text;
  v_line text;
  v_tail text := 'PASS';
  v_rt jsonb;
  v_rts jsonb;
  v_rt_on boolean;
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

  v_rt_on := null; v_rt := null;
  select s.rank_titles_enabled, s.rank_titles into v_rt_on, v_rts from quiz_settings s where s.company_id = v_company_id;
  if not found then v_rt_on := true; v_rts := public.default_rank_titles(); end if;
  v_rt := v_rts -> (v_rank - 1);
  if coalesce(v_rt_on, false) and v_rank between 1 and 3 and v_rt is not null and jsonb_typeof(v_rt) = 'object' and not exists (select 1 from quiz_sessions os where os.id = v_session_id and os.open_link_id is not null) then
    v_rank_no := v_rank;
    v_ttl := nullif(btrim(v_rt->>'cert_title'), '');
    v_line := nullif(btrim(v_rt->>'cert_line'), '');
    v_tail := coalesce(nullif(btrim(v_rt->>'cert_score'), ''), 'PASS');
  end if;

  select qc.id into v_row_id from quiz_certificates qc where qc.participant_id = p_participant_id;
  if v_row_id is null then
    insert into quiz_certificates (company_id, session_id, participant_id, cert_number, candidate_name, quiz_title, score_line, template, rank_no, title_override, achievement_override)
    values (
      v_company_id, v_session_id, p_participant_id,
      'CERT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
      v_display_name, v_quiz_title, v_pct || '% — ' || v_tail,
      coalesce(v_cert.template, 'dark_elegant'), v_rank_no, v_ttl, v_line
    )
    returning quiz_certificates.id into v_row_id;
  end if;

  return query
  select
    qc.id, qc.cert_number, qc.candidate_name, qc.quiz_title, qc.score_line, qc.template, qc.issued_at,
    coalesce(v_cert.company_name, v_company_display_name, ''), coalesce(v_cert.company_name_align, 'center'),
    v_cert.logo_url, coalesce(v_cert.logo_position, 'top_center'), coalesce(v_cert.logo_scale, 100),
    coalesce(v_cert.watermark_type, 'none'), v_cert.watermark_text, v_cert.watermark_image_url,
    coalesce(qc.title_override, v_cert.title, 'Certificate of Achievement'),
    coalesce(qc.achievement_override, v_cert.achievement_line, 'has successfully completed'),
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
  v_rank_no int;
  v_ttl text;
  v_line text;
  v_tail text := 'PASS';
  v_rt jsonb;
  v_rts jsonb;
  v_rt_on boolean;
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

  v_rt_on := null; v_rt := null;
  select s.rank_titles_enabled, s.rank_titles into v_rt_on, v_rts from quiz_settings s where s.company_id = v_company_id;
  if not found then v_rt_on := true; v_rts := public.default_rank_titles(); end if;
  v_rt := v_rts -> (v_rank - 1);
  if coalesce(v_rt_on, false) and v_rank between 1 and 3 and v_rt is not null and jsonb_typeof(v_rt) = 'object' and not exists (select 1 from exam_sessions os where os.id = v_session_id and os.open_link_id is not null) then
    v_rank_no := v_rank;
    v_ttl := nullif(btrim(v_rt->>'cert_title'), '');
    v_line := nullif(btrim(v_rt->>'cert_line'), '');
    v_tail := coalesce(nullif(btrim(v_rt->>'cert_score'), ''), 'PASS');
  end if;

  select ec.id into v_row_id from exam_certificates ec where ec.participant_id = p_participant_id;
  if v_row_id is null then
    insert into exam_certificates (company_id, session_id, participant_id, cert_number, candidate_name, quiz_title, score_line, template, rank_no, title_override, achievement_override)
    values (
      v_company_id, v_session_id, p_participant_id,
      'CERT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
      v_display_name, v_quiz_title, v_pct || '% — ' || v_tail,
      coalesce(v_cert.template, 'dark_elegant'), v_rank_no, v_ttl, v_line
    )
    returning exam_certificates.id into v_row_id;
  end if;

  return query
  select
    ec.id, ec.cert_number, ec.candidate_name, ec.quiz_title, ec.score_line, ec.template, ec.issued_at,
    coalesce(v_cert.company_name, v_company_display_name, ''), coalesce(v_cert.company_name_align, 'center'),
    v_cert.logo_url, coalesce(v_cert.logo_position, 'top_center'), coalesce(v_cert.logo_scale, 100),
    coalesce(v_cert.watermark_type, 'none'), v_cert.watermark_text, v_cert.watermark_image_url,
    coalesce(ec.title_override, v_cert.title, 'Certificate of Achievement'),
    coalesce(ec.achievement_override, v_cert.achievement_line, 'has successfully completed'),
    v_cert.signatory1_name, v_cert.signatory1_title, v_cert.signatory1_image_url,
    coalesce(v_cert.signatory1_scale, 100), coalesce(v_cert.signatory1_name_scale, 100),
    v_cert.signatory2_name, v_cert.signatory2_title, v_cert.signatory2_image_url,
    coalesce(v_cert.signatory2_scale, 100), coalesce(v_cert.signatory2_name_scale, 100),
    coalesce(v_cert.signature_mode, 'both'), coalesce(v_cert.signature_align, 'center'),
    coalesce(v_cert.photo_enabled, false), coalesce(v_cert.photo_frame, 'circle'), coalesce(v_cert.award_seal, 'none'), ec.candidate_photo_url
  from exam_certificates ec where ec.id = v_row_id;
end;
$function$;

drop function if exists public.get_quiz_player_settings(uuid);
CREATE OR REPLACE FUNCTION public.get_quiz_player_settings(p_session_id uuid)
 RETURNS TABLE(option_font_size integer, option_colors jsonb, sound_enabled boolean, brand_name text, brand_logo_url text, favicon_url text, result_pass_title text, result_pass_message text, result_improve_title text, result_improve_message text, result_fail_title text, result_fail_message text, cert_eligibility text, result_close_minutes integer, rank_titles_enabled boolean, rank_titles jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(qs.option_font_size, 16), coalesce(qs.option_colors, '[
      {"box":"#DC2626","font":"#FFFFFF"},
      {"box":"#2563EB","font":"#FFFFFF"},
      {"box":"#16A34A","font":"#FFFFFF"},
      {"box":"#78350F","font":"#FFFFFF"}
    ]'::jsonb),
    coalesce(qs.sound_enabled, true), qs.brand_name, qs.brand_logo_url, qs.favicon_url,
    qs.result_pass_title, qs.result_pass_message,
    qs.result_improve_title, qs.result_improve_message,
    qs.result_fail_title, qs.result_fail_message,
    coalesce(qs.cert_eligibility, 'all_pass'),
    coalesce(qs.result_close_minutes, 5),
    coalesce(qs.rank_titles_enabled, true), coalesce(qs.rank_titles, public.default_rank_titles())
  from quiz_sessions sess
  left join quiz_settings qs on qs.company_id = sess.company_id
  where sess.id = p_session_id;
$function$;
revoke all on function public.get_quiz_player_settings(uuid) from public, anon;
grant execute on function public.get_quiz_player_settings(uuid) to authenticated;


-- An exam trainee's own rank and the title that goes with it (only once the trainer has released the results, only for a pass,
-- never for an open-link attempt, and only when rank titles are switched on).
create or replace function public.get_my_exam_rank_title(p_session_id uuid)
returns table(my_rank integer, title jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_rank integer;
  v_company uuid;
  v_quiz uuid;
  v_pass integer;
  v_got numeric;
  v_tot numeric;
  v_on boolean;
  v_rts jsonb;
begin
  select ep.id into v_pid from exam_participants ep
   where ep.session_id = p_session_id and ep.auth_user_id = auth.uid() and ep.submitted_at is not null;
  if v_pid is null then return; end if;
  select s.company_id, s.quiz_id into v_company, v_quiz from exam_sessions s
   where s.id = p_session_id and s.results_released and s.open_link_id is null;
  if v_company is null then return; end if;

  select r.rnk, r.m into v_rank, v_got from (
    select ep2.id as pid,
           coalesce((select sum(a.marks_awarded) from exam_answers a join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = ep2.id), 0) as m,
           rank() over (order by coalesce((select sum(a.marks_awarded) from exam_answers a join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = ep2.id), 0) desc) as rnk
      from exam_participants ep2 where ep2.session_id = p_session_id and ep2.submitted_at is not null
  ) r where r.pid = v_pid;

  select coalesce(sum(q.marks), 0) into v_tot from quiz_questions q where q.quiz_id = v_quiz and not q.is_hidden;
  select qz.passing_score_pct into v_pass from quizzes qz where qz.id = v_quiz;
  select st.rank_titles_enabled, st.rank_titles into v_on, v_rts from quiz_settings st where st.company_id = v_company;
  if not found then v_on := true; v_rts := public.default_rank_titles(); end if;

  my_rank := v_rank;
  title := case when coalesce(v_on, false) and v_rank between 1 and 3 and v_tot > 0 and round(100.0 * v_got / v_tot) >= v_pass then v_rts -> (v_rank - 1) end;
  return next;
end;
$$;
revoke all on function public.get_my_exam_rank_title(uuid) from public, anon;
grant execute on function public.get_my_exam_rank_title(uuid) to authenticated;

insert into help_articles (category, title, display_order, keywords, content_html)
select 'live_quiz', 'Topper, 2nd Rank and 3rd Rank Titles', 13, 'topper, rank, 1st, 2nd, 3rd, top three, title, certificate, result, winner, editable',
$art$<p>The three best results of a quiz or exam get their own title instead of plain <em>PASS</em>: <strong>🏆 TOPPER</strong> (rank 1), <strong>🥈 2nd RANK</strong> and <strong>🥉 3rd RANK</strong>. Everyone else who passed is still <em>PASS</em>.</p>
<h2>Where it shows</h2>
<ul>
<li><strong>Results</strong> and the host screen at the end of a quiz, and the exam results table.</li>
<li><strong>The trainee's own result screen</strong> — a special heading and message for ranks 1, 2 and 3.</li>
<li><strong>The certificate</strong> — a different heading (for example “Certificate of Excellence”), a “has secured the 1st Rank in …” line and the rank on the score line.</li>
</ul>
<h2>Change the words</h2>
<p>Open <strong>Settings → Top Rank Titles</strong>. For each of the three ranks you can edit the label, the trainee's heading and message, and the three certificate texts. You can also switch the whole thing off.</p>
<p>Notes: a title is only given to someone who passed. Ties on marks are separated by who answered faster (quiz). A quiz taken through an Open Test Link has no ranking, so it never shows a title. Certificates already issued are not changed.</p>$art$
where not exists (select 1 from help_articles where title = 'Topper, 2nd Rank and 3rd Rank Titles');
