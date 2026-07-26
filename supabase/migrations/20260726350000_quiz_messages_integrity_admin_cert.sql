-- Three features requested together:
-- 1. Admin-configurable result messages (Champion / Need Improvement / Fail)
--    shown to the trainee at the end of a quiz, instead of the hardcoded
--    rank-based text that used to be there.
-- 2. Integrity tracking: the trainee's browser flags tab-switches/backgrounding
--    during a live quiz (Page Visibility API client-side, this RPC just
--    increments a counter) so the host can see "clean session" or which
--    participants switched away.
-- 3. Admin-triggered certificate issuance for ANY participant in their own
--    company's session (not just the trainee's own device) — the host runs
--    the quiz on a TV and wants to hand out certificates from that screen.

alter table quiz_settings add column if not exists result_pass_title text;
alter table quiz_settings add column if not exists result_pass_message text;
alter table quiz_settings add column if not exists result_improve_title text;
alter table quiz_settings add column if not exists result_improve_message text;
alter table quiz_settings add column if not exists result_fail_title text;
alter table quiz_settings add column if not exists result_fail_message text;

alter table quiz_participants add column if not exists tab_switch_count int not null default 0;

-- ── 1. Player-settings RPC gains the six message fields (signature change → drop first) ──
drop function if exists get_quiz_player_settings(uuid);
create function get_quiz_player_settings(p_session_id uuid)
returns table (
  option_font_size int, option_colors jsonb, sound_enabled boolean,
  brand_name text, brand_logo_url text, favicon_url text,
  result_pass_title text, result_pass_message text,
  result_improve_title text, result_improve_message text,
  result_fail_title text, result_fail_message text
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
    qs.result_fail_title, qs.result_fail_message
  from quiz_sessions sess
  left join quiz_settings qs on qs.company_id = sess.company_id
  where sess.id = p_session_id;
$$;

-- ── 2. The calling participant's own grade for the session they just finished ──
create or replace function get_my_result(p_session_id uuid)
returns table (correct_count int, total_questions int, percent_correct int, grade text)
language plpgsql
stable
security definer
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

  select count(*) into v_total from quiz_questions where quiz_id = (select qs2.quiz_id from quiz_sessions qs2 where qs2.id = p_session_id);
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

-- ── 3. Increment the calling participant's own tab-switch counter ──
create or replace function flag_tab_switch(p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update quiz_participants
  set tab_switch_count = tab_switch_count + 1
  where session_id = p_session_id and auth_user_id = auth.uid();
$$;

-- ── 4. Admin-triggered certificate for any participant in one of their own company's sessions ──
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
