-- A long reading section can be split into PARTS (Part 1, Part 2 ...), read one at a time. Induction cards keep their parts
-- inside the existing config (config.parts); project sections and course lessons get their own column. The list holds the
-- section's parts in order; the first entry stands for the section's own main text (its title only) and the others carry
-- their own title and text. Empty list = an ordinary single-page section (everything existing stays exactly as it was).
-- Additive only; the platform's copy / update functions copy whole rows, so parts travel with every copy.

alter table public.real_estate_project_sections
  add column if not exists parts jsonb not null default '[]'::jsonb;

alter table public.lessons
  add column if not exists parts jsonb not null default '[]'::jsonb;
