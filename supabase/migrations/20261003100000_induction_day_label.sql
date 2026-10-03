-- Induction: the label in front of a day's title ("Day 1", "Day 2"...) becomes editable and optional.
--
-- Until now every day was shown as "Day <its position>: <title>", so a company overview that is not part
-- of any day still appeared as "Day 1". Now each day carries its own label:
--
--   NULL          automatic (the old behaviour): "Day 1", "Day 2"... counting only the days that are automatic
--   ''  (empty)   no label at all — just the title
--   'Day 0', 'Week 1', 'Orientation'...   exactly as typed
--
-- Every existing day keeps NULL, so nothing changes for anyone until an admin edits a day.

alter table public.induction_days add column if not exists day_label text;
