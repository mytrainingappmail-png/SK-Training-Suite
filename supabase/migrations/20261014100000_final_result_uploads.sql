-- Final Result: uploaded Excel rounds + per-candidate feedback.
--
-- A trainer often runs the same test twice (or a written test outside the app) and wants ONE final report with
-- everyone's rounds side by side plus feedback. Rounds taken in the app already live in quiz_final_results and exam
-- sessions; this adds:
--   quiz_final_uploads  - a round brought in from an Excel file (rows kept as the trainer mapped them)
--   quiz_final_feedback - the trainer's feedback for one candidate in one folder (batch)
-- Both belong to a folder (restrict delete, like quiz_final_results) and to the company.

create table if not exists quiz_final_uploads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  folder_id uuid not null references quiz_result_folders(id) on delete restrict,
  round_label text not null,
  file_name text not null default '',
  pass_pct int,
  round_date date,
  rows jsonb not null default '[]'::jsonb,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_quiz_final_uploads_folder on quiz_final_uploads (folder_id);
create index if not exists idx_quiz_final_uploads_company on quiz_final_uploads (company_id);

create table if not exists quiz_final_feedback (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  folder_id uuid not null references quiz_result_folders(id) on delete cascade,
  candidate_key text not null,
  display_name text not null default '',
  feedback text not null default '',
  updated_at timestamptz not null default now(),
  unique (folder_id, candidate_key)
);
create index if not exists idx_quiz_final_feedback_company on quiz_final_feedback (company_id);

alter table quiz_final_uploads enable row level security;
alter table quiz_final_feedback enable row level security;

drop policy if exists quiz_final_uploads_admin_scoped on quiz_final_uploads;
create policy quiz_final_uploads_admin_scoped on quiz_final_uploads
  for all using (company_id = current_quiz_admin_company_id())
  with check (company_id = current_quiz_admin_company_id());

drop policy if exists quiz_final_feedback_admin_scoped on quiz_final_feedback;
create policy quiz_final_feedback_admin_scoped on quiz_final_feedback
  for all using (company_id = current_quiz_admin_company_id())
  with check (company_id = current_quiz_admin_company_id());
