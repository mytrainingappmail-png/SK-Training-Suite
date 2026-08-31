-- Three things:
-- 1. Watermark and the small positioned logo mark were one mutually
--    exclusive choice (logo_position included 'watermark' as a 4th
--    option) — picking Watermark made the regular top-corner logo
--    disappear. Splits them: logo_position is now just where the small
--    crisp logo sits (top_center/top_left/top_right), and a separate
--    logo_watermark_enabled toggle independently controls the faint
--    full-page background version — both can be on at once.
-- 2. Company name gets its own alignment control, same left/center/right
--    idea as the signature alignment.

alter table quiz_cert_templates add column if not exists logo_watermark_enabled boolean not null default false;
alter table quiz_cert_templates add column if not exists company_name_align text not null default 'center' check (company_name_align in ('left', 'center', 'right'));

-- Preserve current visual behavior for anyone already using Watermark:
-- turn the toggle on and fall back to a normal top-center logo position
-- so nothing on an existing certificate design silently changes.
update quiz_cert_templates set logo_watermark_enabled = true, logo_position = 'top_center' where logo_position = 'watermark';

alter table quiz_cert_templates drop constraint if exists quiz_cert_templates_logo_position_check;
alter table quiz_cert_templates add constraint quiz_cert_templates_logo_position_check
  check (logo_position in ('top_center', 'top_left', 'top_right'));

-- Both certificate-issuance RPCs now also return logo_watermark_enabled
-- and company_name_align from the active design.

drop function if exists issue_my_certificate(uuid);
create function issue_my_certificate(p_session_id uuid)
returns table (
  id uuid, cert_number text, candidate_name text, quiz_title text,
  score_line text, template text, issued_at timestamptz,
  company_name text, company_name_align text, cert_logo_url text, cert_logo_position text, cert_logo_scale int, cert_logo_watermark_enabled boolean, cert_title text, achievement_line text,
  signatory1_name text, signatory1_title text, signatory1_image_url text, signatory1_scale int, signatory1_name_scale int,
  signatory2_name text, signatory2_title text, signatory2_image_url text, signatory2_scale int, signatory2_name_scale int,
  signature_mode text, signature_align text, photo_enabled boolean, candidate_photo_url text
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
    coalesce(v_cert.company_name, v_company_display_name, ''), coalesce(v_cert.company_name_align, 'center'),
    v_cert.logo_url, coalesce(v_cert.logo_position, 'top_center'), coalesce(v_cert.logo_scale, 100), coalesce(v_cert.logo_watermark_enabled, false),
    coalesce(v_cert.title, 'Certificate of Achievement'),
    coalesce(v_cert.achievement_line, 'has successfully completed'),
    v_cert.signatory1_name, v_cert.signatory1_title, v_cert.signatory1_image_url,
    coalesce(v_cert.signatory1_scale, 100), coalesce(v_cert.signatory1_name_scale, 100),
    v_cert.signatory2_name, v_cert.signatory2_title, v_cert.signatory2_image_url,
    coalesce(v_cert.signatory2_scale, 100), coalesce(v_cert.signatory2_name_scale, 100),
    coalesce(v_cert.signature_mode, 'both'), coalesce(v_cert.signature_align, 'center'),
    coalesce(v_cert.photo_enabled, false), qc.candidate_photo_url
  from quiz_certificates qc where qc.id = v_row_id;
end;
$$;

drop function if exists issue_certificate_for_participant(uuid);
create function issue_certificate_for_participant(p_participant_id uuid)
returns table (
  id uuid, cert_number text, candidate_name text, quiz_title text,
  score_line text, template text, issued_at timestamptz,
  company_name text, company_name_align text, cert_logo_url text, cert_logo_position text, cert_logo_scale int, cert_logo_watermark_enabled boolean, cert_title text, achievement_line text,
  signatory1_name text, signatory1_title text, signatory1_image_url text, signatory1_scale int, signatory1_name_scale int,
  signatory2_name text, signatory2_title text, signatory2_image_url text, signatory2_scale int, signatory2_name_scale int,
  signature_mode text, signature_align text, photo_enabled boolean, candidate_photo_url text
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
    coalesce(v_cert.company_name, v_company_display_name, ''), coalesce(v_cert.company_name_align, 'center'),
    v_cert.logo_url, coalesce(v_cert.logo_position, 'top_center'), coalesce(v_cert.logo_scale, 100), coalesce(v_cert.logo_watermark_enabled, false),
    coalesce(v_cert.title, 'Certificate of Achievement'),
    coalesce(v_cert.achievement_line, 'has successfully completed'),
    v_cert.signatory1_name, v_cert.signatory1_title, v_cert.signatory1_image_url,
    coalesce(v_cert.signatory1_scale, 100), coalesce(v_cert.signatory1_name_scale, 100),
    v_cert.signatory2_name, v_cert.signatory2_title, v_cert.signatory2_image_url,
    coalesce(v_cert.signatory2_scale, 100), coalesce(v_cert.signatory2_name_scale, 100),
    coalesce(v_cert.signature_mode, 'both'), coalesce(v_cert.signature_align, 'center'),
    coalesce(v_cert.photo_enabled, false), qc.candidate_photo_url
  from quiz_certificates qc where qc.id = v_row_id;
end;
$$;
