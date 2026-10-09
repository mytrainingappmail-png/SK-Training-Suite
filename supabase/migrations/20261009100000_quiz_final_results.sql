-- Final Result gets its own storage.
--
-- Until now a "Final Result" folder only pointed at live quiz_sessions (quiz_sessions.folder_id), so deleting a
-- session from Results — or "Delete All" there, or deleting the quiz — silently wiped the Final Result too.
-- A Final Result is now a frozen copy: the participant rows exactly as they were (rank, marks, grade, time) and the
-- per-question answer breakdown, saved in this table. Deleting the original session never touches it, and deleting
-- a Final Result record never touches the session.
--
-- source_session_id / quiz_id deliberately have NO foreign keys, so they can outlive the session / quiz they came from.
-- One copy per source session (saving the same session again refreshes it, or moves it to another folder).

create table if not exists quiz_final_results (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  folder_id uuid not null references quiz_result_folders(id) on delete restrict,
  source_session_id uuid,
  quiz_id uuid,
  quiz_title text not null default '',
  started_at timestamptz,
  ended_at timestamptz,
  passing_score_pct int,
  improve_threshold_pct int,
  rows jsonb not null default '[]'::jsonb,
  distribution jsonb not null default '[]'::jsonb,
  saved_by uuid,
  saved_at timestamptz not null default now()
);

create index if not exists idx_quiz_final_results_company on quiz_final_results (company_id);
create index if not exists idx_quiz_final_results_folder on quiz_final_results (folder_id);
create unique index if not exists uq_quiz_final_results_source on quiz_final_results (company_id, source_session_id) where source_session_id is not null;

alter table quiz_final_results enable row level security;

drop policy if exists quiz_final_results_admin_scoped on quiz_final_results;
create policy quiz_final_results_admin_scoped on quiz_final_results
  for all using (company_id = current_quiz_admin_company_id())
  with check (company_id = current_quiz_admin_company_id());

-- One-time backfill: every session already filed in a folder gets its frozen copy, so nothing already saved in
-- Final Result is lost the next time its source session is deleted.
insert into quiz_final_results (company_id, folder_id, source_session_id, quiz_id, quiz_title, started_at, ended_at,
                                passing_score_pct, improve_threshold_pct, rows, distribution)
select
  s.company_id,
  s.folder_id,
  s.id,
  s.quiz_id,
  coalesce(z.title, ''),
  s.started_at,
  s.ended_at,
  z.passing_score_pct,
  z.improve_threshold_pct,
  coalesce((select jsonb_agg(to_jsonb(r) order by r.rank) from quiz_session_results r where r.session_id = s.id), '[]'::jsonb),
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'question_id', q.id,
        'question_text', q.question_text,
        'display_order', q.display_order,
        'totalAnswered', (select count(*) from quiz_answers a where a.session_id = s.id and a.question_id = q.id),
        'options', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'option_id', o.id,
              'option_text', o.option_text,
              'is_correct', o.is_correct,
              'count', (select count(*) from quiz_answers a where a.session_id = s.id and a.selected_option_id = o.id)
            ) order by o.display_order)
          from quiz_question_options o where o.question_id = q.id), '[]'::jsonb)
      ) order by q.display_order)
    from quiz_questions q where q.quiz_id = s.quiz_id and not q.is_hidden), '[]'::jsonb)
from quiz_sessions s
left join quizzes z on z.id = s.quiz_id
where s.folder_id is not null
on conflict do nothing;
