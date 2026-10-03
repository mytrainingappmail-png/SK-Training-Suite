-- Induction: a "standalone" part (a company overview, a welcome video…) that is NOT one of the days.
--
-- The label ("Day 1", none, own text) only decides what is WRITTEN in front of a day's title. Whether the
-- day belongs to the day-by-day order is a separate choice:
--
--   standalone = false  (default)  a normal day: it follows the day before it, and the next day follows it
--   standalone = true              always open, nothing is needed before it, and it does not hold the next
--                                  day back; it is not counted when days are numbered automatically
--
-- Existing days are unchanged (false), except the one case where the admin had already used "no label" together
-- with "anytime" to mean exactly this — that is turned into a standalone part.

alter table public.induction_days add column if not exists standalone boolean not null default false;

update public.induction_days set standalone = true where day_label = '' and unlock_mode = 'anytime';
