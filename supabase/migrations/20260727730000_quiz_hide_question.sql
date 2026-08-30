-- Per-question "hide" toggle — a hidden question is skipped entirely
-- when a quiz is launched live (never served, never answerable) and
-- excluded from every total-question/percentage/pass-fail calculation,
-- so results reflect only the remaining visible questions. Unlike
-- deleting a question, hiding is reversible — the question and its
-- options stay intact, just excluded from play until unhidden.

alter table quiz_questions add column if not exists is_hidden boolean not null default false;

-- ── Every place that counts/serves quiz_questions for a live session or
-- a result/certificate must now exclude hidden ones. ──────────────────

create or replace function get_current_quiz_question(p_session_id uuid)
returns table (
  question_id uuid, question_text text, type text, timer_seconds int,
  question_index int, total_questions int,
  option_id uuid, option_text text, option_order int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
  v_quiz_id uuid;
  v_company_id uuid;
  v_idx int;
  v_qid uuid;
  v_order uuid[];
  v_shuffle_options boolean;
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

  if not quiz_module_enabled_for_company(v_company_id) then
    raise exception 'Live Quiz is not enabled for this company.';
  end if;

  select shuffle_options into v_shuffle_options from quizzes where id = v_quiz_id;

  if v_order is not null and v_idx < array_length(v_order, 1) then
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
    qq.id, qq.question_text, qq.type, coalesce(qq.timer_seconds, qz.default_timer_seconds),
    v_idx, (select count(*) from quiz_questions where quiz_id = v_quiz_id and not is_hidden)::int,
    qo.id, qo.option_text,
    (case when v_shuffle_options
      then row_number() over (order by md5(qo.id::text || v_participant_id::text))
      else row_number() over (order by qo.display_order)
    end)::int as option_order
  from quiz_questions qq
  join quizzes qz on qz.id = qq.quiz_id
  join quiz_question_options qo on qo.question_id = qq.id
  where qq.id = v_qid
  order by option_order;
end;
$$;

create or replace function get_my_result(p_session_id uuid)
returns table (correct_count int, total_questions int, percent_correct int, grade text)
language plpgsql
stable security definer
set search_path = public
as $$
declare
  v_correct int;
  v_pass_pct int;
  v_improve_pct int;
  v_total int;
  v_pct int;
begin
  select qp.correct_count, qz.passing_score_pct, qz.improve_threshold_pct
    into v_correct, v_pass_pct, v_improve_pct
  from quiz_participants qp
  join quiz_sessions qs on qs.id = qp.session_id
  join quizzes qz on qz.id = qs.quiz_id
  where qp.session_id = p_session_id and qp.auth_user_id = auth.uid();

  if v_correct is null then
    raise exception 'Not a participant in this session.';
  end if;

  select count(*) into v_total from quiz_questions where quiz_id = (select qs2.quiz_id from quiz_sessions qs2 where qs2.id = p_session_id) and not is_hidden;
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_correct / v_total) end;

  return query select
    v_correct, v_total, v_pct,
    case
      when v_pct >= v_pass_pct then 'PASS'
      when v_pct >= v_improve_pct then 'NEED_IMPROVEMENT'
      else 'FAIL'
    end;
end;
$$;

create or replace function get_my_answer_review(p_session_id uuid)
returns table (question_index int, question_text text, explanation text, option_id uuid, option_text text, is_correct boolean, was_chosen boolean)
language plpgsql
stable security definer
set search_path = public
as $$
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
  select qq.display_order, qq.question_text, qq.explanation,
    qo.id, qo.option_text, qo.is_correct,
    (qa.selected_option_id = qo.id)
  from quiz_questions qq
  join quiz_question_options qo on qo.question_id = qq.id
  left join quiz_answers qa on qa.question_id = qq.id and qa.participant_id = v_participant_id
  where qq.quiz_id = v_quiz_id and not qq.is_hidden
  order by qq.display_order, qo.display_order;
end;
$$;

create or replace view quiz_session_results as
select
  qs.id as session_id,
  qs.quiz_id,
  qs.company_id,
  qz.title as quiz_title,
  qz.passing_score_pct,
  qz.improve_threshold_pct,
  qs.started_at,
  qs.ended_at,
  (select count(*) from quiz_questions qq where qq.quiz_id = qz.id and not qq.is_hidden) as total_questions,
  qp.id as participant_id,
  qp.display_name,
  qp.score,
  qp.correct_count,
  qp.total_response_time_ms,
  rank() over (partition by qs.id order by qp.correct_count desc, qp.total_response_time_ms) as rank,
  case
    when (select count(*) from quiz_questions qq where qq.quiz_id = qz.id and not qq.is_hidden) = 0 then 0::numeric
    else round(100.0 * qp.correct_count::numeric / (select count(*) from quiz_questions qq where qq.quiz_id = qz.id and not qq.is_hidden)::numeric)
  end as percent_correct,
  case
    when (select count(*) from quiz_questions qq where qq.quiz_id = qz.id and not qq.is_hidden) = 0 then 'FAIL'
    when round(100.0 * qp.correct_count::numeric / (select count(*) from quiz_questions qq where qq.quiz_id = qz.id and not qq.is_hidden)::numeric) >= qz.passing_score_pct::numeric then 'PASS'
    when round(100.0 * qp.correct_count::numeric / (select count(*) from quiz_questions qq where qq.quiz_id = qz.id and not qq.is_hidden)::numeric) >= qz.improve_threshold_pct::numeric then 'NEED_IMPROVEMENT'
    else 'FAIL'
  end as grade
from quiz_sessions qs
join quizzes qz on qz.id = qs.quiz_id
join quiz_participants qp on qp.session_id = qs.id;

create or replace function issue_my_certificate(p_session_id uuid)
returns table (
  id uuid, cert_number text, candidate_name text, quiz_title text,
  score_line text, template text, issued_at timestamptz,
  company_name text, cert_logo_url text, cert_logo_position text, cert_logo_scale int, cert_title text, achievement_line text,
  signatory1_name text, signatory1_title text, signatory1_image_url text, signatory1_scale int, signatory1_name_scale int,
  signatory2_name text, signatory2_title text, signatory2_image_url text, signatory2_scale int, signatory2_name_scale int,
  signature_mode text, signature_align text
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
  v_cert record;
  v_eligibility text;
  v_company_display_name text;
  v_rank int;
  v_issue_certificate boolean;
begin
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
    coalesce(v_cert.company_name, v_company_display_name, ''),
    v_cert.logo_url, coalesce(v_cert.logo_position, 'top_center'), coalesce(v_cert.logo_scale, 100),
    coalesce(v_cert.title, 'Certificate of Achievement'),
    coalesce(v_cert.achievement_line, 'has successfully completed'),
    v_cert.signatory1_name, v_cert.signatory1_title, v_cert.signatory1_image_url,
    coalesce(v_cert.signatory1_scale, 100), coalesce(v_cert.signatory1_name_scale, 100),
    v_cert.signatory2_name, v_cert.signatory2_title, v_cert.signatory2_image_url,
    coalesce(v_cert.signatory2_scale, 100), coalesce(v_cert.signatory2_name_scale, 100),
    coalesce(v_cert.signature_mode, 'both'), coalesce(v_cert.signature_align, 'center')
  from quiz_certificates qc where qc.id = v_row_id;
end;
$$;

create or replace function issue_certificate_for_participant(p_participant_id uuid)
returns table (
  id uuid, cert_number text, candidate_name text, quiz_title text,
  score_line text, template text, issued_at timestamptz,
  company_name text, cert_logo_url text, cert_logo_position text, cert_logo_scale int, cert_title text, achievement_line text,
  signatory1_name text, signatory1_title text, signatory1_image_url text, signatory1_scale int, signatory1_name_scale int,
  signatory2_name text, signatory2_title text, signatory2_image_url text, signatory2_scale int, signatory2_name_scale int,
  signature_mode text, signature_align text
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
  v_cert record;
  v_eligibility text;
  v_company_display_name text;
  v_rank int;
  v_issue_certificate boolean;
begin
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
    coalesce(v_cert.company_name, v_company_display_name, ''),
    v_cert.logo_url, coalesce(v_cert.logo_position, 'top_center'), coalesce(v_cert.logo_scale, 100),
    coalesce(v_cert.title, 'Certificate of Achievement'),
    coalesce(v_cert.achievement_line, 'has successfully completed'),
    v_cert.signatory1_name, v_cert.signatory1_title, v_cert.signatory1_image_url,
    coalesce(v_cert.signatory1_scale, 100), coalesce(v_cert.signatory1_name_scale, 100),
    v_cert.signatory2_name, v_cert.signatory2_title, v_cert.signatory2_image_url,
    coalesce(v_cert.signatory2_scale, 100), coalesce(v_cert.signatory2_name_scale, 100),
    coalesce(v_cert.signature_mode, 'both'), coalesce(v_cert.signature_align, 'center')
  from quiz_certificates qc where qc.id = v_row_id;
end;
$$;
