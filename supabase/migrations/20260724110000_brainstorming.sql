-- Brainstorming — a lightweight puzzles/riddles module for employee
-- engagement. Deliberately NOT tied to the assessment engine and has no
-- scoring: it's meant to feel like a fun brain-teaser, not another exam.
-- Platform-wide content (same convention as help_articles) so it's
-- written once and every company's employees see the same library —
-- read-open to any authenticated user, write restricted to the platform
-- operator (both S&K and Realty Smartz, per the recent parity grant).

create table if not exists brainstorming_items (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text not null default 'General',
  difficulty text not null default 'Medium' check (difficulty in ('Easy', 'Medium', 'Hard')),
  active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_brainstorming_items_order on brainstorming_items (display_order);

alter table brainstorming_items enable row level security;

create policy brainstorming_items_read on brainstorming_items
  for select using (auth.uid() is not null and (active = true or current_company_is_platform_operator()));

create policy brainstorming_items_write on brainstorming_items
  for insert with check (current_company_is_platform_operator());

create policy brainstorming_items_update on brainstorming_items
  for update using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());

create policy brainstorming_items_delete on brainstorming_items
  for delete using (current_company_is_platform_operator());

-- A handful of real starter riddles so the section isn't empty on day one.
insert into brainstorming_items (question, answer, category, difficulty, display_order)
select 'A real estate agent shows 3 houses in 3 hours, but takes no breaks. If each showing takes the same amount of time, and there was a 15-minute drive between each house, how long was each showing?', 'Total time = 180 minutes, minus 2 drives of 15 minutes each (30 minutes) = 150 minutes for 3 showings = 50 minutes each.', 'Logic', 'Medium', 1
where not exists (select 1 from brainstorming_items where question like 'A real estate agent shows 3 houses%');

insert into brainstorming_items (question, answer, category, difficulty, display_order)
select 'I am not alive, but I can grow. I do not have lungs, but I need air. What am I?', 'Fire.', 'Riddles', 'Easy', 2
where not exists (select 1 from brainstorming_items where question like 'I am not alive, but I can grow%');

insert into brainstorming_items (question, answer, category, difficulty, display_order)
select 'A client says "I''ll buy the flat if the price per sqft drops by 20%, but the total price only drops by 10%." What must be true about the flat''s size?', 'The size must have increased - the developer likely offered a larger unit at the same total price reduction, effectively lowering the per-sqft rate more than the total price.', 'Sales Puzzle', 'Hard', 3
where not exists (select 1 from brainstorming_items where question like 'A client says "I''ll buy the flat%');

insert into brainstorming_items (question, answer, category, difficulty, display_order)
select 'What has keys but can''t open locks?', 'A piano (or a keyboard).', 'Riddles', 'Easy', 4
where not exists (select 1 from brainstorming_items where question like 'What has keys but can%');
