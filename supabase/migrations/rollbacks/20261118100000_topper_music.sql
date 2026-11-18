-- Rollback: removes the topper's phone music setting and its read function.
drop function if exists public.get_my_topper_music(text, uuid);
alter table public.quiz_settings drop constraint if exists quiz_settings_topper_music_check;
alter table public.quiz_settings drop constraint if exists quiz_settings_topper_music_volume_check;
alter table public.quiz_settings drop column if exists topper_music;
alter table public.quiz_settings drop column if exists topper_music_url;
alter table public.quiz_settings drop column if exists topper_music_volume;
