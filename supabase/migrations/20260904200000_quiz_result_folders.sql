-- "Batch Records" — lets a quiz admin move an ended session (typically a
-- final test, after all the practice runs) into a named, permanent folder
-- so it stops cluttering the everyday session list/Performance table/
-- exports and becomes a stable, retrievable record instead ("give me the
-- Batch 12 result" months later). Folders are a flat, company-wide
-- organizational label — not tied to a specific quiz — since one batch's
-- final record may span more than one quiz/module.

create table if not exists quiz_result_folders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  created_by uuid references quiz_admins(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_quiz_result_folders_company on quiz_result_folders (company_id);

alter table quiz_result_folders enable row level security;

drop policy if exists quiz_result_folders_admin_scoped on quiz_result_folders;
create policy quiz_result_folders_admin_scoped on quiz_result_folders
  for all using (company_id = current_quiz_admin_company_id())
  with check (company_id = current_quiz_admin_company_id());

-- Nullable: a session with folder_id = null is still an ordinary, everyday
-- session (the common case) and stays exactly where it already appears.
-- "on delete set null" is a defence-in-depth backstop only — the app itself
-- refuses to delete a folder that still has sessions in it (see
-- quizResultFolderRepository.deleteFolder), so this should rarely fire.
alter table quiz_sessions add column if not exists folder_id uuid references quiz_result_folders(id) on delete set null;
create index if not exists idx_quiz_sessions_folder on quiz_sessions (folder_id);

-- Re-expose folder_id through the results view so the Results page can
-- partition an already-fetched result set into "everyday" vs "archived
-- into a batch folder" without a second round-trip per folder.
-- Postgres only allows CREATE OR REPLACE VIEW to ADD columns at the end of
-- the select list (existing columns must keep their name/order/type), so
-- folder_id is appended last. The rest of this must otherwise match the
-- view's latest prior definition exactly (from
-- 20260727730000_quiz_hide_question.sql — the is_hidden-aware question
-- count and the total_response_time_ms/rank columns it added) or the
-- replace is rejected as "cannot drop columns from view".
create or replace view quiz_session_results as
select
  qs.id as session_id,
  qs.quiz_id,
  qs.company_id,
  qz.title as quiz_title,
  qz.passing_score_pct,
  qz.improve_threshold_pct,
  qs.started_at,
  qs.ended_at,
  (select count(*) from quiz_questions qq where qq.quiz_id = qz.id and not qq.is_hidden) as total_questions,
  qp.id as participant_id,
  qp.display_name,
  qp.score,
  qp.correct_count,
  qp.total_response_time_ms,
  rank() over (partition by qs.id order by qp.correct_count desc, qp.total_response_time_ms) as rank,
  case
    when (select count(*) from quiz_questions qq where qq.quiz_id = qz.id and not qq.is_hidden) = 0 then 0::numeric
    else round(100.0 * qp.correct_count::numeric / (select count(*) from quiz_questions qq where qq.quiz_id = qz.id and not qq.is_hidden)::numeric)
  end as percent_correct,
  case
    when (select count(*) from quiz_questions qq where qq.quiz_id = qz.id and not qq.is_hidden) = 0 then 'FAIL'
    when round(100.0 * qp.correct_count::numeric / (select count(*) from quiz_questions qq where qq.quiz_id = qz.id and not qq.is_hidden)::numeric) >= qz.passing_score_pct::numeric then 'PASS'
    when round(100.0 * qp.correct_count::numeric / (select count(*) from quiz_questions qq where qq.quiz_id = qz.id and not qq.is_hidden)::numeric) >= qz.improve_threshold_pct::numeric then 'NEED_IMPROVEMENT'
    else 'FAIL'
  end as grade,
  qs.folder_id
from quiz_sessions qs
join quizzes qz on qz.id = qs.quiz_id
join quiz_participants qp on qp.session_id = qs.id;
