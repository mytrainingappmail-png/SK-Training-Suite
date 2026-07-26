-- issue_my_certificate only returned the bare record — rendering a
-- certificate also needs the company's display settings (title,
-- achievement line, brand/company name, signatories), which live in
-- quiz_settings — a table the participant's own session can't read via
-- RLS (admin-scoped only). Rather than open that table up, extend this
-- SECURITY DEFINER RPC (which already bypasses RLS internally) to also
-- return the display fields the certificate renderer needs.
-- Postgres won't let CREATE OR REPLACE change a function's OUT-parameter
-- signature (only the body) — must drop first.
drop function if exists issue_my_certificate(uuid);

create function issue_my_certificate(p_session_id uuid)
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

  select count(*) into v_total from quiz_questions where quiz_id = (select quiz_id from quiz_sessions where id = p_session_id);
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_correct / v_total) end;

  if v_pct < v_pass_pct then
    raise exception 'Certificates are only issued for a passing score.';
  end if;

  select company_name into v_company_display_name from companies where id = v_company_id;
  select * into v_settings from quiz_settings where company_id = v_company_id;

  select qc.id into v_row_id from quiz_certificates qc where qc.participant_id = v_participant_id;
  if v_row_id is null then
    insert into quiz_certificates (company_id, session_id, participant_id, cert_number, candidate_name, quiz_title, score_line, template)
    values (
      v_company_id, p_session_id, v_participant_id,
      'CERT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
      v_display_name, v_quiz_title, v_pct || '% — PASS',
      coalesce(v_settings.cert_template, 'dark_elegant')
    )
    returning id into v_row_id;
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
