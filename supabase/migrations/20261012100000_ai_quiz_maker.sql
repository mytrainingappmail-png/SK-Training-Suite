-- Log of AI Quiz Maker runs (supabase/functions/generate-quiz-questions). It does two jobs: a per-company daily cap so the
-- platform's free AI allowance is shared fairly, and a record of who generated what. Only the edge function (service
-- role) writes or reads it — RLS is on with no policies, so no browser can touch it.

create table if not exists ai_quiz_generations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  employee_id uuid,
  requested int not null default 0,
  produced int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_quiz_generations_company on ai_quiz_generations (company_id, created_at desc);

alter table ai_quiz_generations enable row level security;
