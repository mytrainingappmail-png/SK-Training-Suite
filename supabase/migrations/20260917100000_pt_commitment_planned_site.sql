-- The Morning Commitment only ever tracked a Site Visit COUNT
-- (sv_planned) — never WHERE. A flexible report that's supposed to answer
-- "what's the site-visit plan for the weekend" needs a place, not just a
-- number, so add one optional freeform field alongside it.
alter table pt_commitments add column if not exists planned_site text;
