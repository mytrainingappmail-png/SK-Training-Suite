-- Two separate requests that came in together:
--
-- 1. "2-3 certificate drafts, enable one, that one downloads" — the
--    certificate DESIGN (template/branding/signatures) used to be a
--    single flat set of columns on quiz_settings, one per company. This
--    moves the design fields into their own table so a company can keep
--    several saved designs and flip which one is live without losing
--    the others. cert_eligibility stays on quiz_settings — it's a
--    separate concept (who qualifies), not a design choice.
--
-- 2. "practice quizzes shouldn't offer a certificate" — a per-quiz
--    on/off toggle, independent of eligibility/design.

alter table quizzes add column if not exists issue_certificate boolean not null default true;

create table quiz_cert_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null default 'Draft',
  is_active boolean not null default false,
  template text not null default 'dark_elegant' check (template in ('classic_gold', 'royal_blue', 'modern_purple', 'minimal_white', 'dark_elegant')),
  company_name text,
  logo_url text,
  logo_position text not null default 'top_center' check (logo_position in ('top_center', 'top_left', 'top_right', 'watermark')),
  title text not null default 'Certificate of Achievement',
  achievement_line text not null default 'has successfully completed',
  signatory1_name text,
  signatory1_title text,
  signatory1_image_url text,
  signatory1_scale int not null default 100 check (signatory1_scale between 50 and 150),
  signatory1_name_scale int not null default 100 check (signatory1_name_scale between 50 and 150),
  signatory2_name text,
  signatory2_title text,
  signatory2_image_url text,
  signatory2_scale int not null default 100 check (signatory2_scale between 50 and 150),
  signatory2_name_scale int not null default 100 check (signatory2_name_scale between 50 and 150),
  signature_mode text not null default 'both' check (signature_mode in ('both', 'single')),
  signature_align text not null default 'center' check (signature_align in ('left', 'center', 'right')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_quiz_cert_templates_company on quiz_cert_templates(company_id);
-- Only one active design per company — this is what "enable one, that
-- one downloads" is enforced by at the database level.
create unique index idx_quiz_cert_templates_one_active on quiz_cert_templates(company_id) where is_active;

alter table quiz_cert_templates enable row level security;

create policy quiz_cert_templates_select on quiz_cert_templates for select
  using (company_id = current_quiz_admin_company_id());
create policy quiz_cert_templates_insert on quiz_cert_templates for insert
  with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
create policy quiz_cert_templates_update on quiz_cert_templates for update
  using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit())
  with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
create policy quiz_cert_templates_delete on quiz_cert_templates for delete
  using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());

-- Flipping the active flag has to be atomic (the partial unique index
-- would otherwise reject a two-step client-side toggle mid-transition).
create or replace function set_active_quiz_cert_template(p_template_id uuid) returns void
language plpgsql security invoker set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from quiz_cert_templates where id = p_template_id;
  if v_company_id is null then
    raise exception 'Certificate draft not found.';
  end if;
  update quiz_cert_templates set is_active = false, updated_at = now() where company_id = v_company_id and is_active = true;
  update quiz_cert_templates set is_active = true, updated_at = now() where id = p_template_id;
end;
$$;

-- Backfill: every company's existing single certificate design becomes
-- its first, active draft — nothing about how certificates currently
-- look changes for anyone today.
insert into quiz_cert_templates (
  company_id, name, is_active, template, company_name, logo_url, logo_position, title, achievement_line,
  signatory1_name, signatory1_title, signatory1_image_url, signatory1_scale, signatory1_name_scale,
  signatory2_name, signatory2_title, signatory2_image_url, signatory2_scale, signatory2_name_scale,
  signature_mode, signature_align
)
select
  qs.company_id, 'Draft 1', true, qs.cert_template, qs.cert_company_name, qs.cert_logo_url, qs.cert_logo_position, qs.cert_title, qs.cert_achievement_line,
  qs.cert_signatory1_name, qs.cert_signatory1_title, qs.cert_signatory1_image_url, qs.cert_signatory1_scale, qs.cert_signatory1_name_scale,
  qs.cert_signatory2_name, qs.cert_signatory2_title, qs.cert_signatory2_image_url, qs.cert_signatory2_scale, qs.cert_signatory2_name_scale,
  qs.cert_signature_mode, qs.cert_signature_align
from quiz_settings qs;

-- Design fields now live on quiz_cert_templates — cert_eligibility
-- stays here, it's a separate "who qualifies" policy, not a design.
alter table quiz_settings
  drop column if exists cert_template,
  drop column if exists cert_company_name,
  drop column if exists cert_logo_url,
  drop column if exists cert_logo_position,
  drop column if exists cert_title,
  drop column if exists cert_achievement_line,
  drop column if exists cert_signatory1_name,
  drop column if exists cert_signatory1_title,
  drop column if exists cert_signatory1_image_url,
  drop column if exists cert_signatory1_scale,
  drop column if exists cert_signatory1_name_scale,
  drop column if exists cert_signatory2_name,
  drop column if exists cert_signatory2_title,
  drop column if exists cert_signatory2_image_url,
  drop column if exists cert_signatory2_scale,
  drop column if exists cert_signatory2_name_scale,
  drop column if exists cert_signature_mode,
  drop column if exists cert_signature_align;

-- Both certificate-issuance RPCs now: (1) refuse if the quiz itself has
-- certificates turned off, (2) pull the design from the company's
-- ACTIVE quiz_cert_templates row instead of quiz_settings.

drop function if exists issue_my_certificate(uuid);
create function issue_my_certificate(p_session_id uuid)
returns table (
  id uuid, cert_number text, candidate_name text, quiz_title text,
  score_line text, template text, issued_at timestamptz,
  company_name text, cert_logo_url text, cert_logo_position text, cert_title text, achievement_line text,
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

  select count(*) into v_total from quiz_questions where quiz_id = (select qs2.quiz_id from quiz_sessions qs2 where qs2.id = p_session_id);
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
    v_cert.logo_url, coalesce(v_cert.logo_position, 'top_center'),
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

drop function if exists issue_certificate_for_participant(uuid);
create function issue_certificate_for_participant(p_participant_id uuid)
returns table (
  id uuid, cert_number text, candidate_name text, quiz_title text,
  score_line text, template text, issued_at timestamptz,
  company_name text, cert_logo_url text, cert_logo_position text, cert_title text, achievement_line text,
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

  select count(*) into v_total from quiz_questions where quiz_id = (select qs2.quiz_id from quiz_sessions qs2 where qs2.id = v_session_id);
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
    v_cert.logo_url, coalesce(v_cert.logo_position, 'top_center'),
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
