-- Induction: every section of a Day (page / FAQ / test) becomes its own card with its own thumbnail,
-- instead of everything sitting on one long page.
--
--  * induction_day_sections.thumbnail_url  — the card picture (optional; a colourful default is drawn)
--  * induction_section_views               — which cards an employee has opened. "Mark Day Complete"
--                                            only becomes available once every reading card was opened,
--                                            so completing a day really means it was read.

alter table public.induction_day_sections add column if not exists thumbnail_url text;

create table if not exists public.induction_section_views (
  employee_id uuid not null references public.employees(id) on delete cascade,
  section_id  uuid not null references public.induction_day_sections(id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  primary key (employee_id, section_id)
);

create index if not exists induction_section_views_section_idx on public.induction_section_views (section_id);

alter table public.induction_section_views enable row level security;
revoke all on public.induction_section_views from anon;

-- An employee reads and records only their own views.
drop policy if exists induction_section_views_own on public.induction_section_views;
create policy induction_section_views_own on public.induction_section_views
  for all to authenticated
  using (employee_id in (select id from public.employees where auth_user_id = auth.uid()))
  with check (employee_id in (select id from public.employees where auth_user_id = auth.uid()));
