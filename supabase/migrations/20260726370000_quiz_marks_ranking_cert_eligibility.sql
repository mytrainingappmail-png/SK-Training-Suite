-- Marks-based ranking (independent from the gamified "score" the live
-- leaderboard uses), a competition-style certificate eligibility setting,
-- and an explanation shown immediately after answering a question.
--
-- Rank is defined everywhere as: correct_count desc, then total time spent
-- answering asc (faster tiebreak) — never the speed-bonus "score" the
-- in-quiz leaderboard sidebar uses, which stays purely for fun.

alter table quiz_participants add column if not exists total_response_time_ms int not null default 0;

alter table quiz_settings add column if not exists cert_eligibility text not null default 'all_pass'
  check (cert_eligibility in ('all_pass', 'top1', 'top3'));

-- ── submit_quiz_answer: track total_response_time_ms, return explanation ──
drop function if exists submit_quiz_answer(uuid, uuid, uuid, int);
create function submit_quiz_answer(
  p_session_id uuid, p_question_id uuid, p_option_id uuid, p_response_time_ms int
)
returns table (is_correct boolean, correct_option_id uuid, points_awarded int, explanation text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
  v_correct boolean := false;
  v_correct_option uuid;
  v_marks int;
  v_max_timer int;
  v_points int := 0;
  v_phase text;
  v_explanation text;
begin
  select id into v_participant_id from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase into v_phase from quiz_sessions where id = p_session_id;
  if v_phase <> 'question' then
    raise exception 'This question is no longer accepting answers.';
  end if;

  select id into v_correct_option from quiz_question_options
  where question_id = p_question_id and is_correct = true limit 1;

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
$$;

-- ── quiz_session_results view gains a marks-based rank column ──
-- (CREATE OR REPLACE can't reorder/insert columns mid-view, only append —
-- and total_response_time_ms/rank are inserted before percent_correct, so
-- the view must be dropped first.)
drop view if exists quiz_session_results;
create view quiz_session_results as
select
  qs.id as session_id,
  qs.quiz_id,
  qs.company_id,
  qz.title as quiz_title,
  qz.passing_score_pct,
  qz.improve_threshold_pct,
  qs.started_at,
  qs.ended_at,
  (select count(*) from quiz_questions qq where qq.quiz_id = qz.id) as total_questions,
  qp.id as participant_id,
  qp.display_name,
  qp.score,
  qp.correct_count,
  qp.total_response_time_ms,
  rank() over (partition by qs.id order by qp.correct_count desc, qp.total_response_time_ms asc) as rank,
  case when (select count(*) from quiz_questions qq where qq.quiz_id = qz.id) = 0 then 0
       else round(100.0 * qp.correct_count / (select count(*) from quiz_questions qq where qq.quiz_id = qz.id))
  end as percent_correct,
  case
    when (select count(*) from quiz_questions qq where qq.quiz_id = qz.id) = 0 then 'FAIL'
    when round(100.0 * qp.correct_count / (select count(*) from quiz_questions qq where qq.quiz_id = qz.id)) >= qz.passing_score_pct then 'PASS'
    when round(100.0 * qp.correct_count / (select count(*) from quiz_questions qq where qq.quiz_id = qz.id)) >= qz.improve_threshold_pct then 'NEED_IMPROVEMENT'
    else 'FAIL'
  end as grade
from quiz_sessions qs
join quizzes qz on qz.id = qs.quiz_id
join quiz_participants qp on qp.session_id = qs.id;

-- ── get_quiz_player_settings gains cert_eligibility (drop first — signature change) ──
drop function if exists get_quiz_player_settings(uuid);
create function get_quiz_player_settings(p_session_id uuid)
returns table (
  option_font_size int, option_colors jsonb, sound_enabled boolean,
  brand_name text, brand_logo_url text, favicon_url text,
  result_pass_title text, result_pass_message text,
  result_improve_title text, result_improve_message text,
  result_fail_title text, result_fail_message text,
  cert_eligibility text
)
language sql
stable
security definer
set search_path = public
as $$
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
    coalesce(qs.cert_eligibility, 'all_pass')
  from quiz_sessions sess
  left join quiz_settings qs on qs.company_id = sess.company_id
  where sess.id = p_session_id;
$$;

-- ── Certificate issuance now also enforces cert_eligibility by rank ──
create or replace function issue_my_certificate(p_session_id uuid)
returns table (
  id uuid, cert_number text, candidate_name text, quiz_title text,
  score_line text, template text, issued_at timestamptz,
  company_name text, cert_title text, achievement_line text,
  signatory1_name text, signatory1_title text,
  signatory2_name text, signatory2_title text
)
language plpgsql
security definer
set search_path = public
as $$
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
  v_settings record;
  v_company_display_name text;
  v_rank int;
begin
  select qp.id, qs.company_id, qz.title, qp.display_name, qp.correct_count, qz.passing_score_pct
    into v_participant_id, v_company_id, v_quiz_title, v_display_name, v_correct, v_pass_pct
  from quiz_participants qp
  join quiz_sessions qs on qs.id = qp.session_id
  join quizzes qz on qz.id = qs.quiz_id
  where qp.session_id = p_session_id and qp.auth_user_id = auth.uid();

  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select count(*) into v_total from quiz_questions where quiz_id = (select qs2.quiz_id from quiz_sessions qs2 where qs2.id = p_session_id);
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_correct / v_total) end;

  if v_pct < v_pass_pct then
    raise exception 'Certificates are only issued for a passing score.';
  end if;

  select c.company_name into v_company_display_name from companies c where c.id = v_company_id;
  select * into v_settings from quiz_settings where company_id = v_company_id;

  select r.rnk into v_rank from (
    select qp2.id, rank() over (order by qp2.correct_count desc, qp2.total_response_time_ms asc) as rnk
    from quiz_participants qp2 where qp2.session_id = p_session_id
  ) r where r.id = v_participant_id;

  if coalesce(v_settings.cert_eligibility, 'all_pass') = 'top1' and v_rank > 1 then
    raise exception 'Certificates go to the top-ranked participant only for this quiz.';
  elsif coalesce(v_settings.cert_eligibility, 'all_pass') = 'top3' and v_rank > 3 then
    raise exception 'Certificates go to the top 3 ranked participants for this quiz.';
  end if;

  select qc.id into v_row_id from quiz_certificates qc where qc.participant_id = v_participant_id;
  if v_row_id is null then
    insert into quiz_certificates (company_id, session_id, participant_id, cert_number, candidate_name, quiz_title, score_line, template)
    values (
      v_company_id, p_session_id, v_participant_id,
      'CERT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
      v_display_name, v_quiz_title, v_pct || '% — PASS',
      coalesce(v_settings.cert_template, 'dark_elegant')
    )
    returning quiz_certificates.id into v_row_id;
  end if;

  return query
  select
    qc.id, qc.cert_number, qc.candidate_name, qc.quiz_title, qc.score_line, qc.template, qc.issued_at,
    coalesce(v_settings.cert_company_name, v_company_display_name, ''),
    coalesce(v_settings.cert_title, 'Certificate of Achievement'),
    coalesce(v_settings.cert_achievement_line, 'has successfully completed'),
    v_settings.cert_signatory1_name, v_settings.cert_signatory1_title,
    v_settings.cert_signatory2_name, v_settings.cert_signatory2_title
  from quiz_certificates qc where qc.id = v_row_id;
end;
$$;

create or replace function issue_certificate_for_participant(p_participant_id uuid)
returns table (
  id uuid, cert_number text, candidate_name text, quiz_title text,
  score_line text, template text, issued_at timestamptz,
  company_name text, cert_title text, achievement_line text,
  signatory1_name text, signatory1_title text,
  signatory2_name text, signatory2_title text
)
language plpgsql
security definer
set search_path = public
as $$
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
  v_settings record;
  v_company_display_name text;
  v_rank int;
begin
  select qs.company_id, qp.session_id, qz.title, qp.display_name, qp.correct_count, qz.passing_score_pct
    into v_company_id, v_session_id, v_quiz_title, v_display_name, v_correct, v_pass_pct
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

  select count(*) into v_total from quiz_questions where quiz_id = (select qs2.quiz_id from quiz_sessions qs2 where qs2.id = v_session_id);
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_correct / v_total) end;

  if v_pct < v_pass_pct then
    raise exception 'Certificates are only issued for a passing score.';
  end if;

  select c.company_name into v_company_display_name from companies c where c.id = v_company_id;
  select * into v_settings from quiz_settings where company_id = v_company_id;

  select r.rnk into v_rank from (
    select qp2.id, rank() over (order by qp2.correct_count desc, qp2.total_response_time_ms asc) as rnk
    from quiz_participants qp2 where qp2.session_id = v_session_id
  ) r where r.id = p_participant_id;

  if coalesce(v_settings.cert_eligibility, 'all_pass') = 'top1' and v_rank > 1 then
    raise exception 'Certificates go to the top-ranked participant only for this quiz.';
  elsif coalesce(v_settings.cert_eligibility, 'all_pass') = 'top3' and v_rank > 3 then
    raise exception 'Certificates go to the top 3 ranked participants for this quiz.';
  end if;

  select qc.id into v_row_id from quiz_certificates qc where qc.participant_id = p_participant_id;
  if v_row_id is null then
    insert into quiz_certificates (company_id, session_id, participant_id, cert_number, candidate_name, quiz_title, score_line, template)
    values (
      v_company_id, v_session_id, p_participant_id,
      'CERT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
      v_display_name, v_quiz_title, v_pct || '% — PASS',
      coalesce(v_settings.cert_template, 'dark_elegant')
    )
    returning quiz_certificates.id into v_row_id;
  end if;

  return query
  select
    qc.id, qc.cert_number, qc.candidate_name, qc.quiz_title, qc.score_line, qc.template, qc.issued_at,
    coalesce(v_settings.cert_company_name, v_company_display_name, ''),
    coalesce(v_settings.cert_title, 'Certificate of Achievement'),
    coalesce(v_settings.cert_achievement_line, 'has successfully completed'),
    v_settings.cert_signatory1_name, v_settings.cert_signatory1_title,
    v_settings.cert_signatory2_name, v_settings.cert_signatory2_title
  from quiz_certificates qc where qc.id = v_row_id;
end;
$$;
