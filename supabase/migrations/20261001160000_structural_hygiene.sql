-- Structural hygiene (Phase 7).
--
-- 1. Deleting a branch/department/designation silently deleted every employee
--    in it (ON DELETE CASCADE). It now refuses instead. The check is DEFERRABLE
--    (made at commit) so removing a whole company, where everything cascades
--    together, still works.
--    NOT changed on purpose: exam_answers/quiz_answers.question_id. The quiz
--    builder saves edits by deleting and re-creating a quiz's questions, so
--    refusing there would block editing any exam that has past results. That
--    needs a builder that updates questions in place first.
-- 2. Foreign-key columns with no index (slow joins/deletes as data grows).
-- 3. Two SECURITY DEFINER functions without a fixed search_path.
-- 4. Session-only functions (and trigger functions) were executable by the
--    anonymous role; they fail for anon anyway, so close the door.

-- ═══ 1. Foreign keys: refuse instead of cascade ═════════════════════════════
do $$
declare
  r record;
  v_def text;
begin
  for r in
    select c.conrelid::regclass::text as tbl, c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confdeltype in ('c', 'a') and not c.condeferrable and c.connamespace = 'public'::regnamespace
      and array_length(c.conkey, 1) = 1
      and (
        (c.conrelid = 'employees'::regclass and a.attname in ('branch_id', 'department_id', 'designation_id'))
        or (c.conrelid = 'departments'::regclass and a.attname = 'branch_id')
        or (c.conrelid = 'designations'::regclass and a.attname in ('department_id', 'branch_id'))
      )
  loop
    select pg_get_constraintdef(oid) into v_def from pg_constraint
      where conname = r.conname and conrelid = r.tbl::regclass;
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I %s', r.tbl, r.conname, replace(v_def, 'ON DELETE CASCADE', 'ON DELETE NO ACTION') || ' DEFERRABLE INITIALLY DEFERRED');
  end loop;
end $$;

-- ═══ 2. Index every foreign-key column that has none ════════════════════════
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass::text as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
  loop
    execute format('create index if not exists %I on %s (%I)',
                   left('idx_' || replace(r.tbl, 'public.', '') || '_' || r.col, 63), r.tbl, r.col);
  end loop;
end $$;

create index if not exists idx_quiz_answers_question_option on quiz_answers (question_id, selected_option_id);

-- ═══ 3. Fixed search_path on the two definer functions that lacked one ══════
alter function current_employee_company_id() set search_path = public;
alter function pt_reports_compute_score() set search_path = public;

-- ═══ 4. No anonymous access to functions that need a signed-in user ═════════
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
      and p.proname = any (array[
        'advance_quiz_session','check_hotspot_tap','convert_course_to_module','convert_module_to_course',
        'create_exam_session','create_survey_session','current_quiz_admin_id','end_exam_session','end_quiz_session',
        'extend_exam_session','extend_survey_session','flag_exam_tab_switch','flag_tab_switch',
        'get_company_active_employee_count','get_current_quiz_question','get_exam_paper','get_exam_participant_detail',
        'get_exam_participants_admin','get_exam_question_stats','get_exam_results','get_exam_session_admin',
        'get_exam_state','get_my_answer_review','get_my_company','get_my_exam_result','get_my_quiz_company_flag',
        'get_my_result','get_platform_ticket_raiser','grade_exam_answer','issue_certificate_for_participant',
        'issue_my_certificate','join_exam_session','join_quiz_session','pause_quiz_session','quiz_participant_heartbeat',
        'release_exam_results','resume_quiz_session','save_exam_answer','start_exam_now','start_quiz_session',
        'start_survey_session_now','submit_exam','submit_quiz_answer','submit_quiz_hotspot_answer',
        -- trigger functions are never called directly
        'audit_row_change','audit_events_immutable','enforce_employee_limit','enforce_course_limit',
        'enforce_certificate_limit','notify_operator_of_platform_ticket','notify_raiser_of_platform_reply',
        'guard_companies_columns','guard_employees_columns','guard_quiz_admins_columns','employees_reset_lock_on_unlock'
      ])
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;
