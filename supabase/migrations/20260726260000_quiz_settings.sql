-- ============================================================================
-- LIVE QUIZ MODULE — Phase 2 (part 1): per-company settings.
--
-- Consolidates several small "global config" keys the reference app kept
-- separately in localStorage (im_appearance, im_branding, im_cert,
-- im_joinmode, im_champ_music, im_sound) into ONE row per company —
-- cleaner than five+ separate tables for what is really just "this
-- company's Live Quiz configuration".
-- ============================================================================

create table if not exists quiz_settings (
  company_id uuid primary key references companies(id) on delete cascade,

  -- Branding (white-label player-facing display)
  brand_name text,
  brand_tagline text,
  brand_logo_url text,

  -- Appearance (player answer buttons)
  option_font_size int not null default 16 check (option_font_size between 10 and 28),
  option_colors jsonb not null default '[
    {"box":"#DC2626","font":"#FFFFFF"},
    {"box":"#2563EB","font":"#FFFFFF"},
    {"box":"#16A34A","font":"#FFFFFF"},
    {"box":"#78350F","font":"#FFFFFF"}
  ]'::jsonb,

  sound_enabled boolean not null default true,
  default_join_mode text not null default 'open' check (default_join_mode in ('open','strict')),

  -- Certificate template
  cert_template text not null default 'dark_elegant'
    check (cert_template in ('classic_gold','royal_blue','modern_purple','minimal_white','dark_elegant')),
  cert_company_name text,
  cert_logo_url text,
  cert_title text not null default 'Certificate of Achievement',
  cert_achievement_line text not null default 'has successfully completed',
  cert_signatory1_name text,
  cert_signatory1_title text,
  cert_signatory1_image_url text,
  cert_signatory2_name text,
  cert_signatory2_title text,
  cert_signatory2_image_url text,

  -- Champions TV reveal music
  champ_music text not null default 'builtin' check (champ_music in ('builtin','custom','off')),
  champ_music_url text,

  updated_at timestamptz not null default now()
);

alter table quiz_settings enable row level security;

drop policy if exists quiz_settings_admin_scoped on quiz_settings;
create policy quiz_settings_admin_scoped on quiz_settings
  for all using (company_id = current_quiz_admin_company_id())
  with check (company_id = current_quiz_admin_company_id());

-- Public, correctness-free subset a participant's browser needs to render
-- the quiz with the host company's chosen colors/branding/sound — looked
-- up via the session they've already joined, same SECURITY DEFINER
-- pattern as the other participant-facing RPCs.
create or replace function get_quiz_player_settings(p_session_id uuid)
returns table (
  option_font_size int, option_colors jsonb, sound_enabled boolean,
  brand_name text, brand_logo_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(qs.option_font_size, 16), coalesce(qs.option_colors, '[
      {"box":"#DC2626","font":"#FFFFFF"},
      {"box":"#2563EB","font":"#FFFFFF"},
      {"box":"#16A34A","font":"#FFFFFF"},
      {"box":"#78350F","font":"#FFFFFF"}
    ]'::jsonb),
    coalesce(qs.sound_enabled, true), qs.brand_name, qs.brand_logo_url
  from quiz_sessions sess
  left join quiz_settings qs on qs.company_id = sess.company_id
  where sess.id = p_session_id;
$$;
