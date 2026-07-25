-- Historical sessions imported from the original app have no real
-- Supabase Auth identity behind each named player (they never logged
-- into anything) — only live participants joining via join_quiz_session
-- have a real auth_user_id. Relax the column so imported rows can store
-- null there; RLS visibility for these rows still works fine since the
-- host-company clause in quiz_participants_visible doesn't depend on
-- auth_user_id at all.
alter table quiz_participants alter column auth_user_id drop not null;
