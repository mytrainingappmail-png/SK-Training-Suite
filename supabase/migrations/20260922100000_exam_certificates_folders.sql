-- Exams: certificates + Batch Record folders.
--   * exam_certificates mirrors quiz_certificates (same template/branding
--     settings from quiz_cert_templates) so the existing certificate
--     renderer works unchanged.
--   * exam_sessions.folder_id reuses the company-wide quiz_result_folders.

create table if not exists exam_certificates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  session_id uuid not null references exam_sessions(id) on delete cascade,
  participant_id uuid not null references exam_participants(id) on delete cascade unique,
  cert_number text not null unique,
  candidate_name text not null,
  quiz_title text not null,
  score_line text not null,
  template text not null,
  candidate_photo_url text,
  issued_at timestamptz not null default now()
);

alter table exam_certificates enable row level security;

drop policy if exists exam_certificates_admin_select on exam_certificates;
create policy exam_certificates_admin_select on exam_certificates
  for select using (company_id = current_quiz_admin_company_id());

drop policy if exists exam_certificates_admin_update on exam_certificates;
create policy exam_certificates_admin_update on exam_certificates
  for update using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit())
  with check (company_id = current_quiz_admin_company_id());

alter table exam_sessions add column if not exists folder_id uuid references quiz_result_folders(id) on delete set null;
create index if not exists idx_exam_sessions_folder on exam_sessions (folder_id);

-- Moves an exam session into / out of a Batch Record folder.
create or replace function move_exam_session_to_folder(p_session_id uuid, p_folder_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := current_quiz_admin_company_id();
begin
  if v_company is null or not current_quiz_admin_can_edit() then raise exception 'Not authorized.'; end if;
  if p_folder_id is not null and not exists (select 1 from quiz_result_folders f where f.id = p_folder_id and f.company_id = v_company) then
    raise exception 'Folder not found.';
  end if;
  update exam_sessions set folder_id = p_folder_id where id = p_session_id and company_id = v_company;
  if not found then raise exception 'Exam not found or not authorized.'; end if;
end;
$$;

drop function if exists issue_exam_certificate(uuid);

create or replace function issue_exam_certificate(p_participant_id uuid)
returns table(id uuid, cert_number text, candidate_name text, quiz_title text, score_line text, template text, issued_at timestamptz, company_name text, company_name_align text, cert_logo_url text, cert_logo_position text, cert_logo_scale integer, cert_watermark_type text, cert_watermark_text text, cert_watermark_image_url text, cert_title text, achievement_line text, signatory1_name text, signatory1_title text, signatory1_image_url text, signatory1_scale integer, signatory1_name_scale integer, signatory2_name text, signatory2_title text, signatory2_image_url text, signatory2_scale integer, signatory2_name_scale integer, signature_mode text, signature_align text, photo_enabled boolean, cert_photo_frame text, cert_award_seal text, candidate_photo_url text)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  select coalesce(sum(a.marks_awarded), 0) into v_got from exam_answers a where a.participant_id = p_participant_id;
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_got / v_total) end;
  if v_pct < v_pass_pct then raise exception 'Certificates are only issued for a passing score.'; end if;

  select c.company_name into v_company_display_name from companies c where c.id = v_company_id;
  select qs.cert_eligibility into v_eligibility from quiz_settings qs where qs.company_id = v_company_id;
  select * into v_cert from quiz_cert_templates t where t.company_id = v_company_id and t.is_active = true;

  select r.rnk into v_rank from (
    select ep2.id as pid, rank() over (order by coalesce((select sum(a.marks_awarded) from exam_answers a where a.participant_id = ep2.id), 0) desc) as rnk
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

revoke all on function issue_exam_certificate(uuid) from public, anon;
revoke all on function move_exam_session_to_folder(uuid, uuid) from public, anon;
grant execute on function issue_exam_certificate(uuid) to authenticated;
grant execute on function move_exam_session_to_folder(uuid, uuid) to authenticated;

-- Session admin RPC must expose folder_id so the UI can show the current folder.
-- (Kept separate: read it straight from the table under RLS-free admin RPC.)
create or replace function get_exam_session_folder(p_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select es.folder_id from exam_sessions es where es.id = p_session_id and es.company_id = current_quiz_admin_company_id();
$$;
revoke all on function get_exam_session_folder(uuid) from public, anon;
grant execute on function get_exam_session_folder(uuid) to authenticated;
