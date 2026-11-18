-- Topper's own phone music: when a trainee's result shows they are the TOPPER (rank 1, passed), their phone plays a piece of
-- music the trainer uploaded. Everything is the trainer's choice (off / own music, volume); nothing is built into the app.
-- Additive only: three new settings columns and one read function.

alter table quiz_settings add column if not exists topper_music text not null default 'off';
alter table quiz_settings add column if not exists topper_music_url text;
alter table quiz_settings add column if not exists topper_music_volume integer not null default 80;

alter table quiz_settings drop constraint if exists quiz_settings_topper_music_check;
alter table quiz_settings add constraint quiz_settings_topper_music_check check (topper_music in ('off', 'custom'));
alter table quiz_settings drop constraint if exists quiz_settings_topper_music_volume_check;
alter table quiz_settings add constraint quiz_settings_topper_music_volume_check check (topper_music_volume between 0 and 100);

-- What a trainee's phone needs to play the topper music. Only someone who took part in that quiz / exam gets an answer, and
-- only while the trainer has it switched on and a file/link is set. (Whether THIS trainee is the topper is decided on the
-- result screen, which already knows the rank; the music itself is a public file, there is nothing private in it.)
create or replace function public.get_my_topper_music(p_kind text, p_session_id uuid)
returns table(music_url text, volume integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  if p_kind = 'quiz' then
    select s.company_id into v_company from quiz_sessions s
     where s.id = p_session_id
       and exists (select 1 from quiz_participants p where p.session_id = s.id and p.auth_user_id = auth.uid());
  elsif p_kind = 'exam' then
    select s.company_id into v_company from exam_sessions s
     where s.id = p_session_id
       and exists (select 1 from exam_participants p where p.session_id = s.id and p.auth_user_id = auth.uid());
  end if;
  if v_company is null then return; end if;

  return query
    select st.topper_music_url, st.topper_music_volume
      from quiz_settings st
     where st.company_id = v_company
       and st.topper_music = 'custom'
       and coalesce(btrim(st.topper_music_url), '') <> '';
end;
$$;
revoke all on function public.get_my_topper_music(text, uuid) from public, anon;
grant execute on function public.get_my_topper_music(text, uuid) to authenticated;
