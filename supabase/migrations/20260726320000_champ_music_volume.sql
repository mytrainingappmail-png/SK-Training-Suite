-- The Champions "Reveal on TV" screen needs a volume control alongside the
-- existing champ_music/champ_music_url selector — add the missing column.
alter table quiz_settings add column if not exists champ_music_volume int not null default 70
  check (champ_music_volume between 0 and 100);
