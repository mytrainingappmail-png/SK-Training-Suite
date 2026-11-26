-- Live Quiz: (1) the answer paper (a trainee's review of every question) is released by the trainer, like an exam's results, and can
-- be hidden again or leave by itself after a number of minutes; (2) a quiz or exam can choose its own certificate rule (everyone who
-- passes / top 1 / top 2 / top 3) instead of only the company setting.
--
-- Paper: a session freezes its mode at launch (quiz's own choice, else the company default, else "release"). Mode "off": the paper is never shown (switched off). Mode "release": the
-- trainee's review is refused until the trainer releases it, and refused again once hidden or when the optional minutes run out.
-- Mode "auto": as it always was (shown right after the quiz). Sessions that already exist keep "auto"; a trainee's own one-person
-- attempt (open link) is always "auto" because nobody is there to release it.
-- Certificates: the effective rule is quiz.cert_eligibility, else quiz_settings.cert_eligibility, else all_pass.

-- ── settings: company defaults ───────────────────────────────────────────────
alter table public.quiz_settings
  add column if not exists paper_release_mode text not null default 'release',
  add column if not exists paper_default_minutes integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quiz_settings_paper_release_mode_check') then
    alter table public.quiz_settings add constraint quiz_settings_paper_release_mode_check check (paper_release_mode in ('release', 'auto', 'off'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quiz_settings_paper_default_minutes_check') then
    alter table public.quiz_settings add constraint quiz_settings_paper_default_minutes_check check (paper_default_minutes is null or paper_default_minutes between 1 and 1440);
  end if;
end $$;

-- "top 2" joins the certificate choices
alter table public.quiz_settings drop constraint if exists quiz_settings_cert_eligibility_check;
alter table public.quiz_settings add constraint quiz_settings_cert_eligibility_check check (cert_eligibility in ('all_pass', 'top1', 'top2', 'top3'));

-- ── one quiz / exam may differ (null = follow the company default) ──────────────
alter table public.quizzes
  add column if not exists paper_release_mode text,
  add column if not exists cert_eligibility text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quizzes_paper_release_mode_check') then
    alter table public.quizzes add constraint quizzes_paper_release_mode_check check (paper_release_mode is null or paper_release_mode in ('release', 'auto', 'off'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quizzes_cert_eligibility_check') then
    alter table public.quizzes add constraint quizzes_cert_eligibility_check check (cert_eligibility is null or cert_eligibility in ('all_pass', 'top1', 'top2', 'top3'));
  end if;
end $$;

-- ── the session's paper state ───────────────────────────────────────────────
alter table public.quiz_sessions
  add column if not exists paper_mode text,
  add column if not exists paper_released boolean not null default false,
  add column if not exists paper_released_at timestamptz,
  add column if not exists paper_minutes integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quiz_sessions_paper_mode_check') then
    alter table public.quiz_sessions add constraint quiz_sessions_paper_mode_check check (paper_mode is null or paper_mode in ('release', 'auto', 'off'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quiz_sessions_paper_minutes_check') then
    alter table public.quiz_sessions add constraint quiz_sessions_paper_minutes_check check (paper_minutes is null or paper_minutes between 1 and 1440);
  end if;
end $$;

create or replace function public.quiz_sessions_set_paper_mode() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.paper_mode is null then
    new.paper_mode := case
      when new.open_link_id is not null then 'auto'
      else coalesce((select q.paper_release_mode from quizzes q where q.id = new.quiz_id),
                    (select s.paper_release_mode from quiz_settings s where s.company_id = new.company_id), 'release')
    end;
  end if;
  return new;
end $$;
drop trigger if exists trg_quiz_sessions_paper_mode on public.quiz_sessions;
create trigger trg_quiz_sessions_paper_mode before insert on public.quiz_sessions for each row execute function public.quiz_sessions_set_paper_mode();

-- Is the paper open to the trainees of this session right now?
create or replace function public.quiz_paper_visible(p_session_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(s.phase = 'ended', false)
     and coalesce(s.paper_mode, 'auto') <> 'off'
     and (coalesce(s.paper_mode, 'auto') = 'auto'
          or (s.paper_released and (s.paper_minutes is null or now() < s.paper_released_at + make_interval(mins => s.paper_minutes))))
  from quiz_sessions s where s.id = p_session_id;
$$;
revoke all on function public.quiz_paper_visible(uuid) from public, anon, authenticated;

-- The trainer releases / hides the paper (optionally for a number of minutes).
create or replace function public.release_quiz_paper(p_session_id uuid, p_release boolean, p_minutes integer default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update quiz_sessions
     set paper_released = p_release,
         paper_released_at = case when p_release then now() else null end,
         paper_minutes = case when p_release then nullif(p_minutes, 0) else null end
   where id = p_session_id and phase = 'ended'
     and company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit();
  if not found then raise exception 'Quiz not found, not finished yet, or not authorized.'; end if;
end $$;
revoke all on function public.release_quiz_paper(uuid, boolean, integer) from public, anon;
grant execute on function public.release_quiz_paper(uuid, boolean, integer) to authenticated;

-- ── certificate rule: the quiz's own choice, else the company's ───────────────────────────
create or replace function public.quiz_effective_cert_eligibility(p_quiz_id uuid, p_company_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select q.cert_eligibility from quizzes q where q.id = p_quiz_id),
                  (select s.cert_eligibility from quiz_settings s where s.company_id = p_company_id),
                  'all_pass');
$$;
revoke all on function public.quiz_effective_cert_eligibility(uuid, uuid) from public, anon, authenticated;

-- ── the existing functions, with the new rules ───────────────────────────────

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
  v_eligibility := public.quiz_effective_cert_eligibility((select qs9.quiz_id from quiz_sessions qs9 where qs9.id = p_session_id), v_company_id);
  select * into v_cert from quiz_cert_templates where company_id = v_company_id and is_active = true;

  select r.rnk into v_rank from (
    select qp2.id, rank() over (order by coalesce(qp2.marks_earned, qp2.correct_count)::numeric / nullif(quiz_participant_total(qp2.id), 0) desc nulls last, qp2.total_response_time_ms asc) as rnk
    from quiz_participants qp2 where qp2.session_id = p_session_id
  ) r where r.id = v_participant_id;

  if coalesce(v_eligibility, 'all_pass') = 'top1' and v_rank > 1 then
    raise exception 'Certificates go to the top-ranked participant only for this quiz.';
  elsif coalesce(v_eligibility, 'all_pass') = 'top2' and v_rank > 2 then
    raise exception 'Certificates go to the top 2 ranked participants for this quiz.';
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

  select (case when exists (select 1 from quiz_participants qp3 where qp3.id = p_participant_id and qp3.marks_earned is null) then count(*) else coalesce(sum(marks), 0) end)::int into v_total from quiz_questions where quiz_id = (select qs2.quiz_id from quiz_sessions qs2 where qs2.id = v_session_id) and not is_hidden and quiz_in_set((select qp4.question_ids from quiz_participants qp4 where qp4.id = p_participant_id), quiz_questions.id);
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_correct / v_total) end;

  if v_pct < v_pass_pct then
    raise exception 'Certificates are only issued for a passing score.';
  end if;

  select c.company_name into v_company_display_name from companies c where c.id = v_company_id;
  v_eligibility := public.quiz_effective_cert_eligibility((select qs9.quiz_id from quiz_sessions qs9 where qs9.id = v_session_id), v_company_id);
  select * into v_cert from quiz_cert_templates where company_id = v_company_id and is_active = true;

  select r.rnk into v_rank from (
    select qp2.id, rank() over (order by coalesce(qp2.marks_earned, qp2.correct_count)::numeric / nullif(quiz_participant_total(qp2.id), 0) desc nulls last, qp2.total_response_time_ms asc) as rnk
    from quiz_participants qp2 where qp2.session_id = v_session_id
  ) r where r.id = p_participant_id;

  if coalesce(v_eligibility, 'all_pass') = 'top1' and v_rank > 1 then
    raise exception 'Certificates go to the top-ranked participant only for this quiz.';
  elsif coalesce(v_eligibility, 'all_pass') = 'top2' and v_rank > 2 then
    raise exception 'Certificates go to the top 2 ranked participants for this quiz.';
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

  v_total := exam_participant_total(p_participant_id);
  select coalesce(sum(a.marks_awarded), 0) into v_got from exam_answers a join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = p_participant_id;
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_got / v_total) end;
  if v_pct < v_pass_pct then raise exception 'Certificates are only issued for a passing score.'; end if;

  select c.company_name into v_company_display_name from companies c where c.id = v_company_id;
  v_eligibility := public.quiz_effective_cert_eligibility(v_quiz_id, v_company_id);
  select * into v_cert from quiz_cert_templates t where t.company_id = v_company_id and t.is_active = true;

  select r.rnk into v_rank from (
    select ep2.id as pid, rank() over (order by coalesce((select sum(a.marks_awarded) from exam_answers a join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = ep2.id), 0) / nullif(exam_participant_total(ep2.id), 0) desc nulls last) as rnk
    from exam_participants ep2 where ep2.session_id = v_session_id
  ) r where r.pid = p_participant_id;

  if coalesce(v_eligibility, 'all_pass') = 'top1' and v_rank > 1 then
    raise exception 'Certificates go to the top-ranked participant only.';
  elsif coalesce(v_eligibility, 'all_pass') = 'top2' and v_rank > 2 then
    raise exception 'Certificates go to the top 2 ranked participants for this quiz.';
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

CREATE OR REPLACE FUNCTION public.get_quiz_player_settings(p_session_id uuid)
 RETURNS TABLE(option_font_size integer, option_colors jsonb, sound_enabled boolean, brand_name text, brand_logo_url text, favicon_url text, result_pass_title text, result_pass_message text, result_improve_title text, result_improve_message text, result_fail_title text, result_fail_message text, cert_eligibility text, result_close_minutes integer, rank_titles_enabled boolean, rank_titles jsonb, bg jsonb, live_top jsonb)
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
    public.quiz_effective_cert_eligibility(sess.quiz_id, sess.company_id),
    coalesce(qs.result_close_minutes, 5),
    coalesce(qs.rank_titles_enabled, true), coalesce(qs.rank_titles, public.default_rank_titles()),
    public.quiz_effective_background(sess.quiz_id, sess.company_id),
    public.quiz_effective_live_top(sess.id)
  from quiz_sessions sess
  left join quiz_settings qs on qs.company_id = sess.company_id
  where sess.id = p_session_id;
$function$;

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
  -- the paper (answer review) reaches a trainee only when the trainer has released it (or the quiz is set to show it automatically)
  if not public.quiz_paper_visible(p_session_id) then
    return;
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
