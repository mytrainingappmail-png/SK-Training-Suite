-- Admin-configurable "announcer" for the Brainstorming quiz — background
-- tension music per question, plus a spoken reaction on right/wrong
-- answers. Voice reactions use the browser's own text-to-speech engine
-- (no real celebrity voice is cloned or impersonated — voice_style is a
-- generic host persona, and voice_uri just picks one of the browser's
-- own installed system voices). Single-row, platform-wide config, same
-- convention as brainstorming_items — read-open to any authenticated
-- user, write restricted to the platform operator.

create table if not exists brainstorming_settings (
  id uuid primary key default gen_random_uuid(),
  music_enabled boolean not null default true,
  voice_enabled boolean not null default true,
  voice_style text not null default 'classic' check (voice_style in ('classic', 'energetic', 'dramatic')),
  voice_uri text not null default '',
  updated_at timestamptz not null default now()
);

insert into brainstorming_settings (id)
select gen_random_uuid()
where not exists (select 1 from brainstorming_settings);

alter table brainstorming_settings enable row level security;

create policy brainstorming_settings_read on brainstorming_settings
  for select using (auth.uid() is not null);

create policy brainstorming_settings_write on brainstorming_settings
  for insert with check (current_company_is_platform_operator());

create policy brainstorming_settings_update on brainstorming_settings
  for update using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
