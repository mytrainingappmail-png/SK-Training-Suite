-- Induction: a day, or a single section (card) of a day, can be limited to certain LOCATIONS.
--
--   locations = NULL or empty   shown to everyone (the default — all existing content stays exactly as it is)
--   locations = {gurgaon,mohali}  shown only to employees whose branch is in one of those cities
--
-- The values are short city keys (gurgaon, mohali, noida…), not branch ids, so a day built once in the owner's
-- master account means the same thing in every company it is sent to. The owner sets them; they travel with
-- the content when it is copied or updated.

alter table public.induction_days add column if not exists locations text[];
alter table public.induction_day_sections add column if not exists locations text[];
