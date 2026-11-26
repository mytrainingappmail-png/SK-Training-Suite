-- Undo 20261126120000_leaderboard_percent.sql: drops the two switches. Re-run supabase/migrations/20261031100000_live_top_ranks.sql to restore the earlier get_quiz_live_top (without the percent column).
alter table public.quiz_settings drop column if exists leaderboard_show_percent, drop column if exists live_top_show_percent;
