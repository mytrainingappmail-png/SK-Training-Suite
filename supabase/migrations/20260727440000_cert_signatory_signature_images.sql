-- Certificates already had signatory name/title, but no way to show an
-- actual signature image above the printed name (quiz_settings has had
-- cert_signatory1_image_url/cert_signatory2_image_url columns since the
-- original quiz_settings migration, but nothing ever read them). Both
-- issuance RPCs pull display fields live from quiz_settings at query time
-- (matching the existing pattern for company_name/cert_title/signatory
-- names — nothing here is snapshotted onto the quiz_certificates row
-- itself), so this just adds the two image URLs to what they return.
--
-- Adding output columns changes RETURNS TABLE, so both functions must be
-- dropped before being recreated (CREATE OR REPLACE cannot do this).

drop function if exists issue_my_certificate(uuid);
create function issue_my_certificate(p_session_id uuid)
returns table (
  id uuid, cert_number text, candidate_name text, quiz_title text,
  score_line text, template text, issued_at timestamptz,
  company_name text, cert_title text, achievement_line text,
  signatory1_name text, signatory1_title text, signatory1_image_url text,
  signatory2_name text, signatory2_title text, signatory2_image_url text
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
    v_settings.cert_signatory1_name, v_settings.cert_signatory1_title, v_settings.cert_signatory1_image_url,
    v_settings.cert_signatory2_name, v_settings.cert_signatory2_title, v_settings.cert_signatory2_image_url
  from quiz_certificates qc where qc.id = v_row_id;
end;
$$;

drop function if exists issue_certificate_for_participant(uuid);
create function issue_certificate_for_participant(p_participant_id uuid)
returns table (
  id uuid, cert_number text, candidate_name text, quiz_title text,
  score_line text, template text, issued_at timestamptz,
  company_name text, cert_title text, achievement_line text,
  signatory1_name text, signatory1_title text, signatory1_image_url text,
  signatory2_name text, signatory2_title text, signatory2_image_url text
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
    v_settings.cert_signatory1_name, v_settings.cert_signatory1_title, v_settings.cert_signatory1_image_url,
    v_settings.cert_signatory2_name, v_settings.cert_signatory2_title, v_settings.cert_signatory2_image_url
  from quiz_certificates qc where qc.id = v_row_id;
end;
$$;
