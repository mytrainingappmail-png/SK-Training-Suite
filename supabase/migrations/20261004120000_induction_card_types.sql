-- Induction: more kinds of cards, all optional and fully configurable by the admin (nothing hard-coded):
--
--   acknowledge  "I have read and agree" (policy / rules) — remembers who agreed and when
--   feedback     a feedback form the admin builds (stars, scales, comments, yes/no, choices)
--   task         a practice task the employee submits (text / link / file); the admin can review it
--   contact      a "your buddy / mentor" card with call and WhatsApp buttons
--
--  * induction_day_sections.config       : the settings of the card (labels, questions, options …)
--  * induction_day_sections.requirement  : none = optional | open = must be opened | complete = must be filled in
--  * induction_card_responses            : what employees submitted (one row per card per employee)
--
-- Copies sent to companies carry the new columns automatically (the copier copies every column).

alter table public.induction_day_sections add column if not exists config jsonb not null default '{}'::jsonb;
alter table public.induction_day_sections add column if not exists requirement text not null default 'open';
alter table public.induction_day_sections drop constraint if exists induction_day_sections_requirement_check;
alter table public.induction_day_sections
  add constraint induction_day_sections_requirement_check check (requirement in ('none', 'open', 'complete'));

alter table public.induction_day_sections drop constraint if exists induction_day_sections_section_type_check;
alter table public.induction_day_sections
  add constraint induction_day_sections_section_type_check
  check (section_type in ('page', 'test', 'faq', 'projects', 'acknowledge', 'feedback', 'task', 'contact'));

create table if not exists public.induction_card_responses (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  section_id       uuid not null references public.induction_day_sections(id) on delete cascade,
  employee_id      uuid not null references public.employees(id) on delete cascade,
  kind             text not null check (kind in ('acknowledge', 'feedback', 'task')),
  response         jsonb not null default '{}'::jsonb,
  status           text not null default 'submitted' check (status in ('submitted', 'approved', 'needs_work')),
  reviewer_comment text,
  reviewed_by      uuid references public.employees(id) on delete set null,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (section_id, employee_id)
);
create index if not exists induction_card_responses_section_idx on public.induction_card_responses (section_id);
create index if not exists induction_card_responses_employee_idx on public.induction_card_responses (employee_id);

create or replace function public.induction_card_responses_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists induction_card_responses_touch on public.induction_card_responses;
create trigger induction_card_responses_touch before update on public.induction_card_responses
  for each row execute function public.induction_card_responses_touch();

alter table public.induction_card_responses enable row level security;
revoke all on public.induction_card_responses from anon;

-- an employee reads their own answers, adds them, and can redo them until a reviewer has approved
drop policy if exists induction_card_responses_own_select on public.induction_card_responses;
create policy induction_card_responses_own_select on public.induction_card_responses
  for select to authenticated
  using (employee_id in (select id from public.employees where auth_user_id = auth.uid()));

drop policy if exists induction_card_responses_own_insert on public.induction_card_responses;
create policy induction_card_responses_own_insert on public.induction_card_responses
  for insert to authenticated
  with check (
    employee_id in (select id from public.employees where auth_user_id = auth.uid())
    and company_id = public.current_employee_company_id()
    and exists (select 1 from public.induction_day_sections s where s.id = section_id and s.company_id = induction_card_responses.company_id)
    and status = 'submitted' and reviewed_by is null and reviewer_comment is null
  );

drop policy if exists induction_card_responses_own_update on public.induction_card_responses;
create policy induction_card_responses_own_update on public.induction_card_responses
  for update to authenticated
  using (employee_id in (select id from public.employees where auth_user_id = auth.uid()) and status <> 'approved')
  with check (
    employee_id in (select id from public.employees where auth_user_id = auth.uid())
    and company_id = public.current_employee_company_id()
    and status = 'submitted' and reviewed_by is null and reviewer_comment is null
  );

-- the company's admins see every answer of their company and review them
drop policy if exists induction_card_responses_admin_select on public.induction_card_responses;
create policy induction_card_responses_admin_select on public.induction_card_responses
  for select to authenticated
  using (company_id = public.current_employee_company_id() and public.current_employee_is_company_admin());

drop policy if exists induction_card_responses_admin_update on public.induction_card_responses;
create policy induction_card_responses_admin_update on public.induction_card_responses
  for update to authenticated
  using (company_id = public.current_employee_company_id() and public.current_employee_is_company_admin())
  with check (company_id = public.current_employee_company_id() and public.current_employee_is_company_admin());
