-- Converting Brainstorming from open "reveal the answer" text to a real
-- KBC-style multiple-choice format: 4 options, one correct, played one
-- question at a time with a timer and lifelines. `answer` is kept as the
-- short explanation shown after the employee picks an option (why it's
-- right), not the raw correct text anymore - that now lives in
-- correct_option/option_a-d.

alter table brainstorming_items add column if not exists option_a text not null default '';
alter table brainstorming_items add column if not exists option_b text not null default '';
alter table brainstorming_items add column if not exists option_c text not null default '';
alter table brainstorming_items add column if not exists option_d text not null default '';
alter table brainstorming_items add column if not exists correct_option text not null default 'a' check (correct_option in ('a', 'b', 'c', 'd'));
