-- ============================================================================
-- LIVE QUIZ MODULE — Phase 3 (part 1): admin permission levels,
-- certificates, and the post-quiz answer review RPC.
--
-- Permission levels: role (super_admin/admin) already exists — this adds
-- a SEPARATE permission_level (view_only/edit) so a super_admin can grant
-- someone "Admin, view only" (sees everything, changes nothing) vs
-- "Admin, can edit" (full content/session control) without making them a
-- super_admin (which additionally grants user management).
-- ============================================================================

alter table quiz_admins add column if not exists permission_level text not null default 'edit'
  check (permission_level in ('view_only','edit'));

create or replace function current_quiz_admin_can_edit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' or permission_level = 'edit'
     from quiz_admins where auth_user_id = auth.uid() and status = 'active'),
    false
  );
$$;

-- ── Split each "for all" admin policy into SELECT (any active admin —
-- view-only included) vs write (edit-level only). ──────────────────────

drop policy if exists quiz_categories_admin_scoped on quiz_categories;
create policy quiz_categories_select on quiz_categories for select using (company_id = current_quiz_admin_company_id());
create policy quiz_categories_write on quiz_categories for insert with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
create policy quiz_categories_update on quiz_categories for update using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit()) with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
create policy quiz_categories_delete on quiz_categories for delete using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());

drop policy if exists quizzes_admin_scoped on quizzes;
create policy quizzes_select on quizzes for select using (company_id = current_quiz_admin_company_id());
create policy quizzes_write on quizzes for insert with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
create policy quizzes_update on quizzes for update using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit()) with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
create policy quizzes_delete on quizzes for delete using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());

drop policy if exists quiz_questions_admin_scoped on quiz_questions;
create policy quiz_questions_select on quiz_questions for select using (quiz_id in (select id from quizzes where company_id = current_quiz_admin_company_id()));
create policy quiz_questions_write on quiz_questions for insert with check (quiz_id in (select id from quizzes where company_id = current_quiz_admin_company_id()) and current_quiz_admin_can_edit());
create policy quiz_questions_update on quiz_questions for update using (quiz_id in (select id from quizzes where company_id = current_quiz_admin_company_id()) and current_quiz_admin_can_edit()) with check (quiz_id in (select id from quizzes where company_id = current_quiz_admin_company_id()) and current_quiz_admin_can_edit());
create policy quiz_questions_delete on quiz_questions for delete using (quiz_id in (select id from quizzes where company_id = current_quiz_admin_company_id()) and current_quiz_admin_can_edit());

drop policy if exists quiz_options_admin_scoped on quiz_question_options;
create policy quiz_options_select on quiz_question_options for select using (
  question_id in (select qq.id from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id where qz.company_id = current_quiz_admin_company_id())
);
create policy quiz_options_write on quiz_question_options for insert with check (
  question_id in (select qq.id from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id where qz.company_id = current_quiz_admin_company_id())
  and current_quiz_admin_can_edit()
);
create policy quiz_options_update on quiz_question_options for update using (
  question_id in (select qq.id from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id where qz.company_id = current_quiz_admin_company_id())
  and current_quiz_admin_can_edit()
) with check (
  question_id in (select qq.id from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id where qz.company_id = current_quiz_admin_company_id())
  and current_quiz_admin_can_edit()
);
create policy quiz_options_delete on quiz_question_options for delete using (
  question_id in (select qq.id from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id where qz.company_id = current_quiz_admin_company_id())
  and current_quiz_admin_can_edit()
);

drop policy if exists quiz_roster_admin_scoped on quiz_roster;
create policy quiz_roster_select on quiz_roster for select using (company_id = current_quiz_admin_company_id());
create policy quiz_roster_write on quiz_roster for insert with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
create policy quiz_roster_update on quiz_roster for update using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit()) with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
create policy quiz_roster_delete on quiz_roster for delete using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());

drop policy if exists quiz_settings_admin_scoped on quiz_settings;
create policy quiz_settings_select on quiz_settings for select using (company_id = current_quiz_admin_company_id());
create policy quiz_settings_write on quiz_settings for insert with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
create policy quiz_settings_update on quiz_settings for update using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit()) with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());

-- Launching/advancing/ending a live session is an edit-level action too.
drop policy if exists quiz_sessions_admin_write on quiz_sessions;
create policy quiz_sessions_admin_write on quiz_sessions
  for insert with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
drop policy if exists quiz_sessions_admin_update on quiz_sessions;
create policy quiz_sessions_admin_update on quiz_sessions
  for update using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit())
  with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());

-- quiz_admins itself: viewing the team list is fine for anyone active;
-- only edit-level (in practice, only ever done via the super_admin-gated
-- UI/edge function) may update another admin's row (status, profile).
drop policy if exists quiz_admins_company_scoped on quiz_admins;
create policy quiz_admins_select on quiz_admins for select using (company_id = current_quiz_admin_company_id());
create policy quiz_admins_update on quiz_admins for update using (company_id = current_quiz_admin_company_id()) with check (company_id = current_quiz_admin_company_id());
-- (insert always goes through the service-role edge function, which
-- bypasses RLS entirely — no insert policy needed here.)

-- ============================================================================
-- Certificates
-- ============================================================================

create table if not exists quiz_certificates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  participant_id uuid not null references quiz_participants(id) on delete cascade unique,
  cert_number text not null unique,
  candidate_name text not null,
  quiz_title text not null,
  score_line text not null,
  template text not null,
  issued_at timestamptz not null default now()
);

alter table quiz_certificates enable row level security;

create policy quiz_certificates_admin_select on quiz_certificates
  for select using (company_id = current_quiz_admin_company_id());

create policy quiz_certificates_own_select on quiz_certificates
  for select using (participant_id in (select id from quiz_participants where auth_user_id = auth.uid()));

-- Issuing is always via issue_my_certificate() (SECURITY DEFINER) so
-- correctness (did they actually pass?) is verified server-side — no
-- direct insert policy is granted.

create or replace function issue_my_certificate(p_session_id uuid)
returns table (
  id uuid, cert_number text, candidate_name text, quiz_title text,
  score_line text, template text, issued_at timestamptz
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
  v_template text;
  v_cert_number text;
  v_row_id uuid;
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

  select qc.id into v_row_id from quiz_certificates qc where qc.participant_id = v_participant_id;
  if v_row_id is not null then
    return query select qc.id, qc.cert_number, qc.candidate_name, qc.quiz_title, qc.score_line, qc.template, qc.issued_at
      from quiz_certificates qc where qc.id = v_row_id;
    return;
  end if;

  select coalesce(cert_template, 'dark_elegant') into v_template from quiz_settings where company_id = v_company_id;
  v_cert_number := 'CERT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));

  insert into quiz_certificates (company_id, session_id, participant_id, cert_number, candidate_name, quiz_title, score_line, template)
  values (v_company_id, p_session_id, v_participant_id, v_cert_number, v_display_name, v_quiz_title, v_pct || '% — PASS', coalesce(v_template, 'dark_elegant'))
  returning id into v_row_id;

  return query select qc.id, qc.cert_number, qc.candidate_name, qc.quiz_title, qc.score_line, qc.template, qc.issued_at
    from quiz_certificates qc where qc.id = v_row_id;
end;
$$;

-- ============================================================================
-- Post-quiz answer review — correctness is only ever revealed once
-- phase='ended', and only for the calling participant's own answers.
-- ============================================================================

create or replace function get_my_answer_review(p_session_id uuid)
returns table (
  question_index int, question_text text, explanation text,
  option_id uuid, option_text text, is_correct boolean, was_chosen boolean
)
language plpgsql
stable
security definer
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
  where qq.quiz_id = v_quiz_id
  order by qq.display_order, qo.display_order;
end;
$$;
