-- Undo 20261126110000_induction_hidden_cards.sql: drops the hidden marks (hidden cards show again). The completion function keeps working (it simply has no table to look at, so re-run the previous version of it if needed).
drop table if exists public.induction_hidden_sections cascade;
