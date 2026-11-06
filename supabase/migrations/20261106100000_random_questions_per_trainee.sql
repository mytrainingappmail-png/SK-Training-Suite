-- Random questions per trainee: "give every trainee N of the M questions" (Live Quiz and Exam), on top of the per-trainee shuffle.
--
-- The trainer sets, per quiz / exam, how many questions each person gets (quizzes.pick_count, any number from 1 up; empty = every
-- question). It only applies while "Anti-cheat: different question order for every employee" (shuffle_questions_per_participant) is ON.
-- The number is frozen into the session when it is launched / started (quiz_sessions.pick_count, exam_sessions.pick_count), so changing
-- the quiz later never alters a running one.
--
-- Each trainee's own set is drawn at random when they join and kept (quiz_participants.question_ids / exam_participants.question_ids,
-- NULL = the whole quiz, exactly as before). Everything that used "all the quiz's questions" for a person now uses THEIR set:
-- what they are served, what they may answer, total marks, percentage, grade, rank (rank is by percentage so papers of different
-- total marks stay fair; with equal totals it is identical to the old rank by marks), certificates, results, review and mistakes.
-- A quiz or exam without a pick number behaves exactly as before.

alter table quizzes add column if not exists pick_count integer;
alter table quiz_sessions add column if not exists pick_count integer;
alter table exam_sessions add column if not exists pick_count integer;
alter table quiz_participants add column if not exists question_ids uuid[];
alter table exam_participants add column if not exists question_ids uuid[];

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'quizzes_pick_count_check') then
    alter table quizzes add constraint quizzes_pick_count_check check (pick_count is null or pick_count >= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quiz_sessions_pick_count_check') then
    alter table quiz_sessions add constraint quiz_sessions_pick_count_check check (pick_count is null or pick_count >= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'exam_sessions_pick_count_check') then
    alter table exam_sessions add constraint exam_sessions_pick_count_check check (pick_count is null or pick_count >= 1);
  end if;
end $$;

-- ── helpers ──────────────────────────────────────────────────────────────────
-- Is this question in the person's set? (no set = the whole quiz)
create or replace function quiz_in_set(p_ids uuid[], p_qid uuid)
returns boolean language sql immutable as $$ select p_ids is null or p_qid = any(p_ids) $$;

-- A random set of p_pick of the quiz's visible questions; NULL (= all questions) when no pick is set or it covers everything.
create or replace function quiz_pick_ids(p_quiz_id uuid, p_pick integer)
returns uuid[] language sql volatile security definer set search_path = public as $$
  select case
    when p_pick is null or p_pick < 1 or p_pick >= (select count(*) from quiz_questions q where q.quiz_id = p_quiz_id and not q.is_hidden) then null
    else (select array_agg(s.id) from (select q.id from quiz_questions q where q.quiz_id = p_quiz_id and not q.is_hidden order by random() limit p_pick) s)
  end $$;

-- A live-quiz trainee's own total: marks of THEIR questions (or their number when marks were never recorded - the old count-based result).
create or replace function quiz_participant_total(p_participant_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select (case when qp.marks_earned is null then count(q.id) else coalesce(sum(q.marks), 0) end)::int
  from quiz_participants qp
  join quiz_sessions qs on qs.id = qp.session_id
  left join quiz_questions q on q.quiz_id = qs.quiz_id and not q.is_hidden and (qp.question_ids is null or q.id = any(qp.question_ids))
  where qp.id = p_participant_id
  group by qp.id, qp.marks_earned $$;

-- An exam candidate's own total marks.
create or replace function exam_participant_total(p_participant_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(q.marks), 0)::numeric
  from exam_participants ep
  join exam_sessions es on es.id = ep.session_id
  left join quiz_questions q on q.quiz_id = es.quiz_id and not q.is_hidden and (ep.question_ids is null or q.id = any(ep.question_ids))
  where ep.id = p_participant_id $$;

revoke all on function quiz_pick_ids(uuid, integer) from public, anon, authenticated;
revoke all on function quiz_participant_total(uuid) from public, anon, authenticated;
revoke all on function exam_participant_total(uuid) from public, anon, authenticated;

-- An admin asks which questions each trainee of a session got (for the topic report).
create or replace function get_exam_participant_sets(p_session_id uuid)
returns table (participant_id uuid, question_ids uuid[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from exam_sessions s where s.id = p_session_id and s.company_id = current_quiz_admin_company_id()) then
    raise exception 'Exam not found or not authorized.';
  end if;
  return query select ep.id, ep.question_ids from exam_participants ep where ep.session_id = p_session_id;
end;
$$;
revoke all on function get_exam_participant_sets(uuid) from public, anon;
grant execute on function get_exam_participant_sets(uuid) to authenticated;

create or replace function get_quiz_participant_sets(p_session_id uuid)
returns table (participant_id uuid, question_ids uuid[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from quiz_sessions s where s.id = p_session_id and s.company_id = current_quiz_admin_company_id()) then
    raise exception 'Quiz session not found or not authorized.';
  end if;
  return query select qp.id, qp.question_ids from quiz_participants qp where qp.session_id = p_session_id;
end;
$$;
revoke all on function get_quiz_participant_sets(uuid) from public, anon;
grant execute on function get_quiz_participant_sets(uuid) to authenticated;

-- ── Live Quiz ─────────────────────────────────────────────────────────────────

-- quiz_session_results (view)
create or replace view quiz_session_results as  SELECT qs.id AS session_id,
    qs.quiz_id,
    qs.company_id,
    qz.title AS quiz_title,
    qz.passing_score_pct,
    qz.improve_threshold_pct,
    qs.started_at,
    qs.ended_at,
    tm.total_q::bigint AS total_questions,
    qp.id AS participant_id,
    qp.display_name,
    qp.score,
    qp.correct_count,
    qp.total_response_time_ms,
    rank() OVER (PARTITION BY qs.id ORDER BY (COALESCE(qp.marks_earned, qp.correct_count))::numeric / NULLIF(CASE WHEN (qp.marks_earned IS NULL) THEN tm.total_q ELSE tm.total_marks END, 0) DESC NULLS LAST, qp.total_response_time_ms) AS rank,
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
          WHERE ((qq.quiz_id = qz.id) AND (NOT qq.is_hidden) AND ((qp.question_ids IS NULL) OR (qq.id = ANY (qp.question_ids))))) tm);;

-- join_quiz_session
CREATE OR REPLACE FUNCTION public.join_quiz_session(p_session_id uuid, p_display_name text)
 RETURNS TABLE(participant_id uuid, score integer, correct_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_join_mode text;
  v_company_id uuid;
  v_roster_ok boolean;
  v_existing uuid;
  v_pick integer;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to join a quiz.';
  end if;

  select join_mode, company_id, pick_count into v_join_mode, v_company_id, v_pick
  from quiz_sessions where id = p_session_id and phase <> 'ended';

  if v_company_id is null then
    raise exception 'This quiz session is no longer available.';
  end if;

  if not quiz_module_enabled_for_company(v_company_id) then
    raise exception 'Live Quiz is not enabled for this company.';
  end if;

  if v_join_mode = 'strict' then
    select exists(
      select 1 from quiz_roster
      where company_id = v_company_id and active = true
        and (lower(name) = lower(trim(p_display_name)) or lower(employee_code) = lower(trim(p_display_name)))
    ) into v_roster_ok;
    if not v_roster_ok then
      raise exception 'You are not on the registered trainee list for this quiz.';
    end if;
  end if;

  select id into v_existing from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();

  if v_existing is null then
    insert into quiz_participants (session_id, auth_user_id, display_name)
    values (p_session_id, auth.uid(), trim(p_display_name))
    returning id into v_existing;
    -- "N random questions per trainee": draw this trainee's own set now (only while the anti-cheat per-trainee shuffle is on)
    if v_pick is not null and exists (
         select 1 from quizzes qz join quiz_sessions s on s.quiz_id = qz.id
          where s.id = p_session_id and coalesce(qz.shuffle_questions_per_participant, false) and not coalesce(s.is_practice, false)) then
      update quiz_participants
         set question_ids = quiz_pick_ids((select s2.quiz_id from quiz_sessions s2 where s2.id = p_session_id), v_pick)
       where id = v_existing;
    end if;
  end if;

  return query select qp.id, qp.score, qp.correct_count from quiz_participants qp where qp.id = v_existing;
end;
$function$;

-- quiz_current_question_id
CREATE OR REPLACE FUNCTION public.quiz_current_question_id(p_session_id uuid, p_participant_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_set uuid[];
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

  select qp.question_ids into v_set from quiz_participants qp where qp.id = p_participant_id;

  if v_shuffle then
    select qq.id into v_qid from quiz_questions qq
    where qq.quiz_id = v_quiz and not qq.is_hidden and (v_set is null or qq.id = any(v_set))
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

-- get_current_quiz_question
CREATE OR REPLACE FUNCTION public.get_current_quiz_question(p_session_id uuid)
 RETURNS TABLE(question_id uuid, question_text text, type text, timer_seconds integer, question_index integer, total_questions integer, option_id uuid, option_text text, option_order integer, image_url text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_set uuid[];
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
  select qp.question_ids into v_set from quiz_participants qp where qp.id = v_participant_id;

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
    where qq.quiz_id = v_quiz_id and not qq.is_hidden and (v_set is null or qq.id = any(v_set))
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

-- get_my_result
CREATE OR REPLACE FUNCTION public.get_my_result(p_session_id uuid)
 RETURNS TABLE(correct_count integer, total_questions integer, percent_correct integer, grade text, marks_obtained integer, total_marks integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
   where quiz_id = (select qs2.quiz_id from quiz_sessions qs2 where qs2.id = p_session_id) and not is_hidden
     and quiz_in_set((select qp9.question_ids from quiz_participants qp9 where qp9.session_id = p_session_id and qp9.auth_user_id = auth.uid()), quiz_questions.id);
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

-- get_my_answer_review
CREATE OR REPLACE FUNCTION public.get_my_answer_review(p_session_id uuid)
 RETURNS TABLE(question_index integer, question_text text, explanation text, type text, option_id uuid, option_text text, is_correct boolean, was_chosen boolean, image_url text, target_x numeric, target_y numeric, target_radius numeric, click_x numeric, click_y numeric, hotspot_is_correct boolean, hotspot_zones jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_participant_id uuid;
  v_phase text;
  v_quiz_id uuid;
begin
  select qp.id into v_participant_id from quiz_participants qp
  where qp.session_id = p_session_id and qp.auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase, quiz_id into v_phase, v_quiz_id from quiz_sessions where id = p_session_id;
  if v_phase <> 'ended' then
    raise exception 'Review is only available after the quiz ends.';
  end if;

  return query
  select qq.display_order, qq.question_text, qq.explanation, qq.type,
    qo.id, qo.option_text, qo.is_correct,
    (qa.selected_option_id = qo.id),
    qq.image_url, qq.target_x, qq.target_y, qq.target_radius,
    qa.click_x, qa.click_y, qa.is_correct, qq.hotspot_zones
  from quiz_questions qq
  left join quiz_question_options qo on qo.question_id = qq.id
  left join quiz_answers qa on qa.question_id = qq.id and qa.participant_id = v_participant_id
  where qq.quiz_id = v_quiz_id and not qq.is_hidden
    and quiz_in_set((select qp9.question_ids from quiz_participants qp9 where qp9.id = v_participant_id), qq.id)
  order by qq.display_order, qo.display_order;
end;
$function$;

-- issue_my_certificate
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

  select (case when exists (select 1 from quiz_participants qp3 where qp3.id = v_participant_id and qp3.marks_earned is null) then count(*) else coalesce(sum(marks), 0) end)::int into v_total from quiz_questions where quiz_id = (select qs2.quiz_id from quiz_sessions qs2 where qs2.id = p_session_id) and not is_hidden and quiz_in_set((select qp4.question_ids from quiz_participants qp4 where qp4.id = v_participant_id), quiz_questions.id);
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_correct / v_total) end;

  if v_pct < v_pass_pct then
    raise exception 'Certificates are only issued for a passing score.';
  end if;

  select c.company_name into v_company_display_name from companies c where c.id = v_company_id;
  select cert_eligibility into v_eligibility from quiz_settings where company_id = v_company_id;
  select * into v_cert from quiz_cert_templates where company_id = v_company_id and is_active = true;

  select r.rnk into v_rank from (
    select qp2.id, rank() over (order by coalesce(qp2.marks_earned, qp2.correct_count)::numeric / nullif(quiz_participant_total(qp2.id), 0) desc nulls last, qp2.total_response_time_ms asc) as rnk
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

-- issue_certificate_for_participant
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

  select (case when exists (select 1 from quiz_participants qp3 where qp3.id = p_participant_id and qp3.marks_earned is null) then count(*) else coalesce(sum(marks), 0) end)::int into v_total from quiz_questions where quiz_id = (select qs2.quiz_id from quiz_sessions qs2 where qs2.id = v_session_id) and not is_hidden and quiz_in_set((select qp4.question_ids from quiz_participants qp4 where qp4.id = p_participant_id), quiz_questions.id);
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_correct / v_total) end;

  if v_pct < v_pass_pct then
    raise exception 'Certificates are only issued for a passing score.';
  end if;

  select c.company_name into v_company_display_name from companies c where c.id = v_company_id;
  select cert_eligibility into v_eligibility from quiz_settings where company_id = v_company_id;
  select * into v_cert from quiz_cert_templates where company_id = v_company_id and is_active = true;

  select r.rnk into v_rank from (
    select qp2.id, rank() over (order by coalesce(qp2.marks_earned, qp2.correct_count)::numeric / nullif(quiz_participant_total(qp2.id), 0) desc nulls last, qp2.total_response_time_ms asc) as rnk
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

-- ── Exam ─────────────────────────────────────────────────────────────────────

-- create_exam_session
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
  select qz.company_id, qz.mode, qz.status, qz.reveal_answers, qz.pick_count, qz.shuffle_questions_per_participant into v_quiz from quizzes qz where qz.id = p_quiz_id;
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
                                 reveal_answers, hotspot_feedback_seconds, hotspot_feedback_size, is_practice, pick_count)
      values (p_quiz_id, v_quiz.company_id,
        (select qa.id from quiz_admins qa where qa.auth_user_id = auth.uid() limit 1),
        v_pin, p_duration_seconds, v_opens, v_opens + make_interval(secs => p_duration_seconds),
        case when p_practice then true else coalesce(v_reveal, true) end, coalesce(v_fb_seconds, 3), coalesce(v_fb_size, 'small'), p_practice,
        case when p_practice or not coalesce(v_quiz.shuffle_questions_per_participant, false) then null else v_quiz.pick_count end)
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

-- join_exam_session
CREATE OR REPLACE FUNCTION public.join_exam_session(p_pin text, p_display_name text)
 RETURNS TABLE(exam_session_id uuid, exam_participant_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_s exam_sessions;
  v_pid uuid;
begin
  if auth.uid() is null then raise exception 'Please try again.'; end if;
  if coalesce(trim(p_display_name), '') = '' then raise exception 'Please enter your name to join.'; end if;

  select * into v_s from exam_sessions es where es.pin = p_pin and es.finished_at is null;
  if v_s.id is null then raise exception 'That PIN is not active. Ask your trainer for the current one.'; end if;
  if now() >= v_s.deadline_at then raise exception 'This exam''s time is over.'; end if;
  if not quiz_module_enabled_for_company(v_s.company_id) then raise exception 'Live Quiz is not enabled for this company.'; end if;

  insert into exam_participants (session_id, auth_user_id, display_name)
  values (v_s.id, auth.uid(), trim(p_display_name))
  on conflict (session_id, auth_user_id) do nothing;

  select ep.id into v_pid from exam_participants ep where ep.session_id = v_s.id and ep.auth_user_id = auth.uid();
  -- "N random questions per candidate": draw this candidate's own set once
  if v_s.pick_count is not null then
    update exam_participants set question_ids = quiz_pick_ids(v_s.quiz_id, v_s.pick_count) where id = v_pid and question_ids is null;
  end if;
  return query select v_s.id, v_pid;
end;
$function$;

-- get_exam_paper
CREATE OR REPLACE FUNCTION public.get_exam_paper(p_session_id uuid)
 RETURNS TABLE(question_position integer, question_id uuid, question_text text, type text, marks integer, image_url text, option_id uuid, option_text text, option_order integer, saved_selected_option_id uuid, saved_click_x numeric, saved_click_y numeric, saved_text text, saved_image_paths text[], saved_flagged boolean, saved_hotspot_taps jsonb, hotspot_zone_count integer, saved_is_correct boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_set uuid[];
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
  v_shuffle_q boolean;
  v_shuffle_o boolean;
begin
  select ep.id, ep.submitted_at, ep.question_ids into v_pid, v_sub, v_set
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
    from quiz_questions q where q.quiz_id = v_s.quiz_id and not q.is_hidden and (v_set is null or q.id = any(v_set))
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

-- save_exam_answer
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
  v_locked uuid;
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
  from quiz_questions q where q.id = p_question_id and q.quiz_id = v_s.quiz_id and not q.is_hidden
    and quiz_in_set((select ep9.question_ids from exam_participants ep9 where ep9.id = v_pid), q.id);
  if v_type is null then raise exception 'That question is not part of this exam.'; end if;

  if p_selected_option_id is not null and not exists (
    select 1 from quiz_question_options o where o.id = p_selected_option_id and o.question_id = p_question_id
  ) then raise exception 'That option does not belong to this question.'; end if;

  -- With instant right/wrong feedback on, the first choice is final: once an
  -- option is stored the server keeps it, whatever the browser sends later.
  if v_s.reveal_answers and v_type in ('mcq', 'truefalse') then
    select ea.selected_option_id into v_locked
    from exam_answers ea where ea.participant_id = v_pid and ea.question_id = p_question_id;
    if v_locked is not null then p_selected_option_id := v_locked; end if;
  end if;

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

  return query select case when v_s.reveal_answers then v_is_correct end;
end;
$function$;

-- check_hotspot_tap
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
  v_zone_n int;
  v_checks int;
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
  from quiz_questions q where q.id = p_question_id and q.quiz_id = v_s.quiz_id and q.type = 'hotspot' and not q.is_hidden
    and quiz_in_set((select ep9.question_ids from exam_participants ep9 where ep9.id = v_pid), q.id);
  if v_zones is null then raise exception 'That question is not part of this exam.'; end if;

  -- Answers are not revealed in this exam: never tell the browser.
  if not v_s.reveal_answers then
    return query select null::boolean, null::text;
    return;
  end if;

  -- Budget: enough for multi-point tapping with undo, far too few to map the
  -- image by probing a grid.
  v_zone_n := case when jsonb_typeof(v_zones) = 'array' then jsonb_array_length(v_zones) else 1 end;
  insert into exam_tap_checks as t (participant_id, question_id, checks) values (v_pid, p_question_id, 1)
  on conflict (participant_id, question_id) do update set checks = t.checks + 1
  returning t.checks into v_checks;
  if v_checks > 12 + 6 * greatest(v_zone_n, 1) then
    raise exception 'You have used all your tap checks for this question.';
  end if;

  v_idx := hotspot_zone_index_hit(v_zones, p_x, p_y);
  if v_idx is null then
    return query select false, null::text;
  else
    return query select true, nullif(trim(coalesce(v_zones->v_idx->>'label', '')), '');
  end if;
end;
$function$;

-- get_exam_results
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
    coalesce((select sum(a.marks_awarded) from exam_answers a join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = ep.id and a.auto_graded), 0)::numeric,
    coalesce((select sum(a.marks_awarded) from exam_answers a join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = ep.id and not a.auto_graded), 0)::numeric,
    (select count(*)::int from exam_answers a join quiz_questions q on q.id = a.question_id
      where a.participant_id = ep.id and q.type = 'written' and a.marks_awarded is null
        and (coalesce(trim(a.text_answer), '') <> '' or cardinality(a.image_paths) > 0)),
    (select coalesce(sum(q.marks), 0)::numeric from quiz_questions q where q.quiz_id = v_s.quiz_id and not q.is_hidden and quiz_in_set(ep.question_ids, q.id))
  from exam_participants ep
  where ep.session_id = p_session_id
  order by ep.display_name;
end;
$function$;

-- get_my_exam_result
CREATE OR REPLACE FUNCTION public.get_my_exam_result(p_session_id uuid)
 RETURNS TABLE(question_order integer, question_text text, type text, marks integer, my_answer_text text, my_selected_option_text text, correct_option_text text, is_correct boolean, marks_awarded numeric, grader_comment text, answered boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  select * into v_s from exam_sessions es where es.id = p_session_id;
  if not v_s.results_released or v_sub is null then raise exception 'Your result is not available yet.'; end if;

  return query
  select q.display_order, q.question_text, q.type, q.marks,
    a.text_answer,
    (select o.option_text from quiz_question_options o where o.id = a.selected_option_id),
    (select string_agg(o.option_text, ' / ' order by o.display_order) from quiz_question_options o where o.question_id = q.id and o.is_correct),
    a.is_correct, a.marks_awarded, a.grader_comment,
    (a.id is not null and (a.selected_option_id is not null or a.click_x is not null or coalesce(trim(a.text_answer), '') <> ''
      or cardinality(a.image_paths) > 0 or jsonb_array_length(coalesce(a.hotspot_taps, '[]'::jsonb)) > 0))
  from quiz_questions q
  left join exam_answers a on a.question_id = q.id and a.participant_id = v_pid
  where q.quiz_id = v_s.quiz_id and not q.is_hidden
    and quiz_in_set((select ep9.question_ids from exam_participants ep9 where ep9.id = v_pid), q.id)
  order by q.display_order;
end;
$function$;

-- get_exam_state
CREATE OR REPLACE FUNCTION public.get_exam_state(p_session_id uuid)
 RETURNS TABLE(participant_id uuid, display_name text, quiz_title text, description text, duration_seconds integer, opens_at timestamp with time zone, deadline_at timestamp with time zone, server_now timestamp with time zone, status text, submitted_at timestamp with time zone, results_released boolean, total_questions integer, passing_score_pct integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_set uuid[];
  v_pid uuid;
  v_dn text;
  v_sub timestamptz;
  v_s exam_sessions;
begin
  select ep.id, ep.display_name, ep.submitted_at, ep.question_ids into v_pid, v_dn, v_sub, v_set
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  select * into v_s from exam_sessions es where es.id = p_session_id;

  return query
  select v_pid, v_dn, qz.title, qz.description, v_s.duration_seconds,
    v_s.opens_at, v_s.deadline_at, now(),
    case when v_s.finished_at is not null or now() >= v_s.deadline_at then 'finished'
         when now() < v_s.opens_at then 'lobby'
         else 'running' end,
    v_sub, v_s.results_released,
    (select count(*)::int from quiz_questions q where q.quiz_id = v_s.quiz_id and not q.is_hidden and (v_set is null or q.id = any(v_set))),
    qz.passing_score_pct
  from quizzes qz where qz.id = v_s.quiz_id;
end;
$function$;

-- get_exam_participant_detail
CREATE OR REPLACE FUNCTION public.get_exam_participant_detail(p_participant_id uuid)
 RETURNS TABLE(answer_id uuid, question_id uuid, question_order integer, question_text text, type text, marks integer, explanation text, image_url text, selected_option_text text, correct_option_text text, text_answer text, image_paths text[], click_x numeric, click_y numeric, hotspot_taps jsonb, hotspot_zones jsonb, answered boolean, flagged boolean, is_correct boolean, marks_awarded numeric, grader_comment text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_s exam_sessions;
begin
  select es.* into v_s from exam_participants ep join exam_sessions es on es.id = ep.session_id
  where ep.id = p_participant_id and es.company_id = current_quiz_admin_company_id();
  if v_s.id is null then raise exception 'Not found or not authorized.'; end if;
  if v_s.finished_at is null then raise exception 'Results are available only after the exam has finished.'; end if;

  return query
  select a.id, q.id, q.display_order, q.question_text, q.type, q.marks, q.explanation,
    q.image_url,
    (select o.option_text from quiz_question_options o where o.id = a.selected_option_id),
    (select string_agg(o.option_text, ' / ' order by o.display_order) from quiz_question_options o where o.question_id = q.id and o.is_correct),
    a.text_answer, coalesce(a.image_paths, '{}'::text[]), a.click_x, a.click_y, coalesce(a.hotspot_taps, '[]'::jsonb), q.hotspot_zones,
    (a.id is not null and (a.selected_option_id is not null or a.click_x is not null or coalesce(trim(a.text_answer), '') <> ''
      or cardinality(a.image_paths) > 0 or jsonb_array_length(coalesce(a.hotspot_taps, '[]'::jsonb)) > 0)),
    coalesce(a.flagged, false),
    a.is_correct, a.marks_awarded, a.grader_comment
  from quiz_questions q
  left join exam_answers a on a.question_id = q.id and a.participant_id = p_participant_id
  where q.quiz_id = v_s.quiz_id and not q.is_hidden
    and quiz_in_set((select ep9.question_ids from exam_participants ep9 where ep9.id = p_participant_id), q.id)
  order by q.display_order;
end;
$function$;

-- get_exam_live_admin
CREATE OR REPLACE FUNCTION public.get_exam_live_admin(p_session_id uuid)
 RETURNS TABLE(participant_id uuid, answered_count integer, correct_count integer, wrong_count integer, written_count integer, auto_marks numeric, possible_marks numeric, stopped_at timestamp with time zone, stop_reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_quiz uuid;
  v_possible numeric;
begin
  select es.quiz_id into v_quiz from exam_sessions es where es.id = p_session_id and es.company_id = current_quiz_admin_company_id();
  if v_quiz is null then raise exception 'Exam not found or not authorized.'; end if;
  select coalesce(sum(q.marks), 0) into v_possible from quiz_questions q where q.quiz_id = v_quiz and not q.is_hidden;

  return query
  with ans as (
    select
      a.participant_id as pid,
      q.type as qtype,
      q.marks as qmarks,
      case
        when q.type = 'written' then (coalesce(trim(a.text_answer), '') <> '' or coalesce(cardinality(a.image_paths), 0) > 0)
        when q.type = 'hotspot' then (a.click_x is not null or jsonb_array_length(coalesce(a.hotspot_taps, '[]'::jsonb)) > 0)
        else a.selected_option_id is not null
      end as answered,
      case
        when q.type = 'written' then null
        when q.type = 'hotspot' then
          case
            when q.hotspot_zones is not null and jsonb_typeof(q.hotspot_zones) = 'array' and jsonb_array_length(q.hotspot_zones) > 0
              then hotspot_zone_hits_count(q.hotspot_zones, coalesce(a.hotspot_taps, '[]'::jsonb)) >= jsonb_array_length(q.hotspot_zones)
            when a.click_x is not null and a.click_y is not null and q.target_x is not null and q.target_y is not null
              then sqrt(power(a.click_x - q.target_x, 2) + power(a.click_y - q.target_y, 2)) <= coalesce(q.target_radius, 6)
            else false
          end
        else coalesce((select o.is_correct from quiz_question_options o where o.id = a.selected_option_id and o.question_id = q.id), false)
      end as ok,
      case
        when q.type = 'written' then 0::numeric
        when q.type = 'hotspot' then
          case
            when q.hotspot_zones is not null and jsonb_typeof(q.hotspot_zones) = 'array' and jsonb_array_length(q.hotspot_zones) > 0
              then round(q.marks * hotspot_zone_hits_count(q.hotspot_zones, coalesce(a.hotspot_taps, '[]'::jsonb))::numeric / jsonb_array_length(q.hotspot_zones), 2)
            when a.click_x is not null and a.click_y is not null and q.target_x is not null and q.target_y is not null
              and sqrt(power(a.click_x - q.target_x, 2) + power(a.click_y - q.target_y, 2)) <= coalesce(q.target_radius, 6)
              then q.marks::numeric
            else 0::numeric
          end
        else case when coalesce((select o.is_correct from quiz_question_options o where o.id = a.selected_option_id and o.question_id = q.id), false)
                  then q.marks::numeric else 0::numeric end
      end as got
    from exam_answers a
    join quiz_questions q on q.id = a.question_id and q.quiz_id = v_quiz and not q.is_hidden
    where a.participant_id in (select id from exam_participants where session_id = p_session_id)
  )
  select
    ep.id,
    coalesce(count(*) filter (where ans.answered), 0)::int,
    coalesce(count(*) filter (where ans.answered and ans.qtype <> 'written' and ans.ok), 0)::int,
    coalesce(count(*) filter (where ans.answered and ans.qtype <> 'written' and not ans.ok), 0)::int,
    coalesce(count(*) filter (where ans.answered and ans.qtype = 'written'), 0)::int,
    coalesce(sum(ans.got) filter (where ans.answered), 0)::numeric,
    (select coalesce(sum(q9.marks), 0)::numeric from quiz_questions q9 where q9.quiz_id = v_quiz and not q9.is_hidden and quiz_in_set(ep.question_ids, q9.id)),
    ep.stopped_at,
    ep.stop_reason
  from exam_participants ep
  left join ans on ans.pid = ep.id
  where ep.session_id = p_session_id
  group by ep.id, ep.stopped_at, ep.stop_reason, ep.joined_at, ep.question_ids
  order by ep.joined_at;
end;
$function$;

-- get_exam_session_admin
CREATE OR REPLACE FUNCTION public.get_exam_session_admin(p_session_id uuid)
 RETURNS TABLE(session_id uuid, quiz_id uuid, quiz_title text, pin text, duration_seconds integer, opens_at timestamp with time zone, deadline_at timestamp with time zone, finished_at timestamp with time zone, server_now timestamp with time zone, results_released boolean, status text, total_questions integer, total_marks numeric, passing_score_pct integer, joined integer, submitted integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_s exam_sessions;
begin
  select * into v_s from exam_sessions es where es.id = p_session_id and es.company_id = current_quiz_admin_company_id();
  if v_s.id is null then raise exception 'Exam not found or not authorized.'; end if;

  if v_s.finished_at is null and now() >= v_s.deadline_at + interval '90 seconds' then
    perform exam_finalize_session(p_session_id, 'timeout');
    select * into v_s from exam_sessions es where es.id = p_session_id;
  end if;

  return query
  select v_s.id, v_s.quiz_id, qz.title, v_s.pin, v_s.duration_seconds,
    v_s.opens_at, v_s.deadline_at, v_s.finished_at, now(),
    v_s.results_released,
    case when v_s.finished_at is not null then 'finished'
         when now() < v_s.opens_at then 'lobby'
         when now() >= v_s.deadline_at then 'closing'
         else 'running' end,
    (select case when v_s.pick_count is not null and v_s.pick_count < count(*) then v_s.pick_count else count(*)::int end from quiz_questions q where q.quiz_id = v_s.quiz_id and not q.is_hidden),
    (select case when v_s.pick_count is not null and v_s.pick_count < count(*) then round(coalesce(sum(q.marks), 0)::numeric * v_s.pick_count / count(*), 2) else coalesce(sum(q.marks), 0)::numeric end from quiz_questions q where q.quiz_id = v_s.quiz_id and not q.is_hidden),
    qz.passing_score_pct,
    (select count(*)::int from exam_participants ep where ep.session_id = v_s.id),
    (select count(*)::int from exam_participants ep where ep.session_id = v_s.id and ep.submitted_at is not null)
  from quizzes qz where qz.id = v_s.quiz_id;
end;
$function$;

-- get_my_exam_mistakes
CREATE OR REPLACE FUNCTION public.get_my_exam_mistakes(p_session_id uuid)
 RETURNS TABLE(question_id uuid, question_order integer, question_text text, explanation text, options jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  select * into v_s from exam_sessions es where es.id = p_session_id;
  if not v_s.results_released or v_sub is null then raise exception 'Your result is not available yet.'; end if;

  return query
  select q.id, q.display_order, q.question_text, coalesce(q.explanation, ''),
    (select coalesce(jsonb_agg(jsonb_build_object('option_id', o.id, 'option_text', o.option_text, 'is_correct', o.is_correct)
                               order by o.display_order), '[]'::jsonb)
       from quiz_question_options o where o.question_id = q.id)
  from quiz_questions q
  left join exam_answers a on a.question_id = q.id and a.participant_id = v_pid
  where q.quiz_id = v_s.quiz_id and not q.is_hidden
    and quiz_in_set((select ep9.question_ids from exam_participants ep9 where ep9.id = v_pid), q.id)
    and q.type in ('mcq', 'truefalse')
    and coalesce(a.is_correct, false) = false
  order by q.display_order;
end;
$function$;

-- get_my_exam_rank_title
CREATE OR REPLACE FUNCTION public.get_my_exam_rank_title(p_session_id uuid)
 RETURNS TABLE(my_rank integer, title jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
           rank() over (order by coalesce((select sum(a.marks_awarded) from exam_answers a join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = ep2.id), 0) / nullif(exam_participant_total(ep2.id), 0) desc nulls last) as rnk
      from exam_participants ep2 where ep2.session_id = p_session_id and ep2.submitted_at is not null
  ) r where r.pid = v_pid;

  v_tot := exam_participant_total(v_pid);
  select qz.passing_score_pct into v_pass from quizzes qz where qz.id = v_quiz;
  select st.rank_titles_enabled, st.rank_titles into v_on, v_rts from quiz_settings st where st.company_id = v_company;
  if not found then v_on := true; v_rts := public.default_rank_titles(); end if;

  my_rank := v_rank;
  title := case when coalesce(v_on, false) and v_rank between 1 and 3 and v_tot > 0 and round(100.0 * v_got / v_tot) >= v_pass then v_rts -> (v_rank - 1) end;
  return next;
end;
$function$;

-- issue_exam_certificate
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

  v_total := exam_participant_total(p_participant_id);
  select coalesce(sum(a.marks_awarded), 0) into v_got from exam_answers a join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = p_participant_id;
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_got / v_total) end;
  if v_pct < v_pass_pct then raise exception 'Certificates are only issued for a passing score.'; end if;

  select c.company_name into v_company_display_name from companies c where c.id = v_company_id;
  select qs.cert_eligibility into v_eligibility from quiz_settings qs where qs.company_id = v_company_id;
  select * into v_cert from quiz_cert_templates t where t.company_id = v_company_id and t.is_active = true;

  select r.rnk into v_rank from (
    select ep2.id as pid, rank() over (order by coalesce((select sum(a.marks_awarded) from exam_answers a join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = ep2.id), 0) / nullif(exam_participant_total(ep2.id), 0) desc nulls last) as rnk
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

-- ── Open test links (a self-start link is its own one-person session) ─────────

-- get_open_test_info
CREATE OR REPLACE FUNCTION public.get_open_test_info(p_token text)
 RETURNS TABLE(title text, mode text, description text, question_count integer, duration_minutes integer, pass_pct integer, status text, company_name text, max_attempts integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l quiz_open_links;
  qz quizzes;
  v_status text;
begin
  select * into l from quiz_open_links where token = p_token;
  if l.id is null then
    return query select null::text, null::text, null::text, 0, 0, 0, 'unavailable'::text, null::text, null::integer;
    return;
  end if;
  select * into qz from quizzes where id = l.quiz_id;
  v_status := case
    when not l.enabled or qz.status <> 'published' or not quiz_module_enabled_for_company(l.company_id) then 'unavailable'
    when l.opens_at is not null and now() < l.opens_at then 'not_yet'
    when l.closes_at is not null and now() >= l.closes_at then 'closed'
    else 'open' end;
  return query select qz.title::text, qz.mode::text, qz.description::text,
    (select case when coalesce(qz.shuffle_questions_per_participant, false) and qz.pick_count is not null and qz.pick_count < count(*) then qz.pick_count else count(*)::int end from quiz_questions q where q.quiz_id = qz.id and not q.is_hidden),
    case when qz.mode = 'exam' then coalesce(qz.exam_duration_minutes, 60) else null end,
    qz.passing_score_pct, v_status,
    (select c.company_name::text from companies c where c.id = l.company_id), l.max_attempts;
end;
$function$;

-- get_open_test_attempts
CREATE OR REPLACE FUNCTION public.get_open_test_attempts(p_link_id uuid)
 RETURNS TABLE(kind text, session_id uuid, participant_id uuid, display_name text, started_at timestamp with time zone, finished_at timestamp with time zone, status text, marks_obtained numeric, total_marks numeric, percent numeric, result text, pending_written integer, tab_switches integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l quiz_open_links;
begin
  select * into l from quiz_open_links where id = p_link_id and company_id = current_quiz_admin_company_id();
  if l.id is null then raise exception 'Link not found or not authorized.'; end if;

  return query
  select 'exam'::text, es.id, ep.id, ep.display_name, ep.joined_at, ep.submitted_at,
    case when ep.submitted_at is not null then (case when ep.submit_reason = 'timeout' then 'time_up' else 'finished' end)
         when now() < es.deadline_at then 'in_progress' else 'not_submitted' end,
    got.m, tot.m,
    case when tot.m > 0 then round(100.0 * got.m / tot.m, 1) else 0 end,
    case when ep.submitted_at is null then null
         when tot.m > 0 and round(100.0 * got.m / tot.m, 1) >= qz.passing_score_pct then 'PASS' else 'FAIL' end,
    (select count(*)::int from exam_answers a join quiz_questions q on q.id = a.question_id
      where a.participant_id = ep.id and q.type = 'written' and a.marks_awarded is null
        and (coalesce(trim(a.text_answer), '') <> '' or cardinality(a.image_paths) > 0)),
    ep.tab_switches
  from exam_sessions es
  join exam_participants ep on ep.session_id = es.id
  join quizzes qz on qz.id = es.quiz_id
  cross join lateral (select coalesce(sum(a.marks_awarded), 0)::numeric as m from exam_answers a
                        join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = ep.id) got
  cross join lateral (select coalesce(sum(q.marks), 0)::numeric as m from quiz_questions q where q.quiz_id = es.quiz_id and not q.is_hidden and quiz_in_set(ep.question_ids, q.id)) tot
  where es.open_link_id = l.id
  union all
  select 'quiz'::text, qs.id, qp.id, qp.display_name, qp.joined_at, case when qs.phase = 'ended' then qs.ended_at end,
    case when qs.phase = 'ended' then 'finished' else 'in_progress' end,
    r.marks_obtained::numeric, r.total_marks::numeric, r.percent_correct::numeric,
    case when qs.phase = 'ended' then r.grade end, 0, qp.tab_switch_count
  from quiz_sessions qs
  join quiz_participants qp on qp.session_id = qs.id
  left join quiz_session_results r on r.participant_id = qp.id
  where qs.open_link_id = l.id
  order by 5 desc;
end;
$function$;

-- start_open_test
CREATE OR REPLACE FUNCTION public.start_open_test(p_token text, p_name text)
 RETURNS TABLE(kind text, session_id uuid, participant_id uuid, quiz_title text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l quiz_open_links;
  qz quizzes;
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_sid uuid;
  v_pid uuid;
  v_used integer;
  v_pin text;
  v_reveal boolean;
  v_fb_seconds integer;
  v_fb_size text;
  v_order uuid[];
  v_seconds integer;
  v_set uuid[];
  i integer;
begin
  if auth.uid() is null then raise exception 'Please try again.'; end if;
  if v_name = '' then raise exception 'Please enter your name.'; end if;
  if char_length(v_name) > 80 then raise exception 'That name is too long.'; end if;

  select * into l from quiz_open_links where token = p_token;
  if l.id is null or not l.enabled then raise exception 'This test link is not active.'; end if;
  select * into qz from quizzes where id = l.quiz_id;
  if qz.status <> 'published' or not quiz_module_enabled_for_company(l.company_id) then raise exception 'This test link is not active.'; end if;
  if l.opens_at is not null and now() < l.opens_at then raise exception 'This test has not opened yet.'; end if;
  if l.closes_at is not null and now() >= l.closes_at then raise exception 'This test is closed.'; end if;

  -- an attempt of this browser that is still running: go back to it
  if qz.mode = 'exam' then
    select es.id, ep.id into v_sid, v_pid
      from exam_sessions es join exam_participants ep on ep.session_id = es.id
     where es.open_link_id = l.id and ep.auth_user_id = auth.uid()
       and ep.submitted_at is null and es.finished_at is null and now() < es.deadline_at
     order by es.created_at desc limit 1;
    if v_sid is not null then
      return query select 'exam'::text, v_sid, v_pid, qz.title;
      return;
    end if;
  else
    select qs.id, qp.id into v_sid, v_pid
      from quiz_sessions qs join quiz_participants qp on qp.session_id = qs.id
     where qs.open_link_id = l.id and qp.auth_user_id = auth.uid() and qs.phase <> 'ended'
     order by qs.created_at desc limit 1;
    if v_sid is not null then
      return query select 'quiz'::text, v_sid, v_pid, qz.title;
      return;
    end if;
  end if;

  -- attempts allowed for one name
  if l.max_attempts is not null then
    select (select count(*) from exam_participants ep join exam_sessions es on es.id = ep.session_id
             where es.open_link_id = l.id and lower(ep.display_name) = lower(v_name))
         + (select count(*) from quiz_participants qp join quiz_sessions qs on qs.id = qp.session_id
             where qs.open_link_id = l.id and lower(qp.display_name) = lower(v_name))
      into v_used;
    if v_used >= l.max_attempts then
      raise exception 'You have already used your % attempt% of this test.', l.max_attempts, case when l.max_attempts = 1 then '' else 's' end;
    end if;
  end if;

  if qz.mode = 'exam' then
    if not exists (select 1 from quiz_questions q where q.quiz_id = qz.id and not q.is_hidden) then raise exception 'This exam has no questions yet.'; end if;
    v_seconds := greatest(60, coalesce(qz.exam_duration_minutes, 60) * 60);
    select coalesce(s.exam_reveal_answers, true), coalesce(s.exam_hotspot_feedback_seconds, 3), coalesce(s.exam_hotspot_feedback_size, 'small')
      into v_reveal, v_fb_seconds, v_fb_size
      from (select 1) one left join quiz_settings s on s.company_id = l.company_id;
    if qz.reveal_answers is not null then v_reveal := qz.reveal_answers; end if;
    for i in 1 .. 10 loop
      v_pin := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
      begin
        insert into exam_sessions (quiz_id, company_id, host_admin_id, pin, duration_seconds, opens_at, deadline_at,
                                   reveal_answers, hotspot_feedback_seconds, hotspot_feedback_size, open_link_id, pick_count)
        values (qz.id, l.company_id, null, v_pin, v_seconds, now(), now() + make_interval(secs => v_seconds),
                coalesce(v_reveal, true), coalesce(v_fb_seconds, 3), coalesce(v_fb_size, 'small'), l.id,
                case when coalesce(qz.shuffle_questions_per_participant, false) then qz.pick_count end)
        returning id into v_sid;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
    if v_sid is null then raise exception 'Could not start the test. Please try again.'; end if;
    insert into exam_participants (session_id, auth_user_id, display_name, question_ids)
    values (v_sid, auth.uid(), v_name, quiz_pick_ids(qz.id, case when coalesce(qz.shuffle_questions_per_participant, false) then qz.pick_count end))
    returning id into v_pid;
    return query select 'exam'::text, v_sid, v_pid, qz.title;
  else
    select array_agg(q.id order by case when qz.shuffle_questions then random() end, q.display_order) into v_order
      from quiz_questions q where q.quiz_id = qz.id and not q.is_hidden;
    if v_order is null then raise exception 'This quiz has no questions yet.'; end if;
    -- "N random questions per trainee": this one-person session gets its own random N (in a random order)
    v_set := quiz_pick_ids(qz.id, case when coalesce(qz.shuffle_questions_per_participant, false) then qz.pick_count end);
    if v_set is not null then v_order := (select array_agg(x order by random()) from unnest(v_set) x); end if;
    select coalesce(s.quiz_reveal_answers, true) into v_reveal
      from (select 1) one left join quiz_settings s on s.company_id = l.company_id;
    if qz.reveal_answers is not null then v_reveal := qz.reveal_answers; end if;
    for i in 1 .. 10 loop
      v_pin := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
      begin
        insert into quiz_sessions (quiz_id, company_id, pin, phase, current_question_index, question_order, started_at, question_started_at,
                                   join_mode, reveal_answers, allow_early_next, open_link_id)
        values (qz.id, l.company_id, v_pin, 'question', 0, v_order, now(), now(), 'open', coalesce(v_reveal, true), true, l.id)
        returning id into v_sid;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
    if v_sid is null then raise exception 'Could not start the test. Please try again.'; end if;
    insert into quiz_participants (session_id, auth_user_id, display_name, question_ids) values (v_sid, auth.uid(), v_name, v_set) returning id into v_pid;
    return query select 'quiz'::text, v_sid, v_pid, qz.title;
  end if;
end;
$function$;

