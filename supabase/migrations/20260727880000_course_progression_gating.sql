-- Real per-lesson completion tracking (didn't exist before — "Mark
-- Complete" only ever nudged enrollments.completion_percentage, so a
-- fresh page load always showed every lesson as incomplete) plus two
-- optional, admin-controlled course toggles: whether "Next" requires the
-- current lesson to be marked complete first (Back is never gated), and
-- whether each module's quiz-lesson must be passed before the next
-- module unlocks.

create table if not exists lesson_progress (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (enrollment_id, lesson_id)
);

alter table lesson_progress enable row level security;

drop policy if exists lesson_progress_company_scoped on lesson_progress;
create policy lesson_progress_company_scoped on lesson_progress
  for all
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter table courses add column if not exists require_completion_before_next boolean not null default false;
alter table courses add column if not exists test_compulsory_after_module boolean not null default false;
