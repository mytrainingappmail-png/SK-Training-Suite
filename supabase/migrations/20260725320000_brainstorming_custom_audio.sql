-- Admin-uploaded audio (their own recording — e.g. their own mimicry/
-- impression, entirely their own content, so no celebrity-voice-cloning
-- concern) takes priority over the built-in generated tension music and
-- browser TTS reactions when set.
alter table brainstorming_settings add column if not exists music_url text not null default '';
alter table brainstorming_settings add column if not exists correct_sound_url text not null default '';
alter table brainstorming_settings add column if not exists wrong_sound_url text not null default '';
