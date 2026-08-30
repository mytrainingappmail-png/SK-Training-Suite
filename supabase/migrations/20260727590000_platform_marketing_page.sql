-- Public marketing homepage — everything on it is admin-editable
-- (platform operator only), and readable with zero login since the
-- whole point is a logged-out landing page. Mirrors the
-- read-public/write-operator split already used for company_modules.

create table platform_marketing_settings (
  id uuid primary key default gen_random_uuid(),
  logo_url text,
  hero_title text not null default 'Training That Actually Sticks',
  hero_subtitle text not null default 'A complete learning management platform for growing teams — courses, assessments, certificates, and reporting in one place.',
  hero_cta_label text not null default 'Start Free Trial',
  about_title text not null default 'About Us',
  about_content_html text not null default '',
  footer_company_name text,
  footer_tagline text,
  footer_copyright_text text,
  whatsapp_number text,
  whatsapp_default_message text not null default 'Hi, I would like to know more about your training platform.',
  contact_email text,
  contact_phone text,
  updated_at timestamptz not null default now()
);

-- Singleton — the app always reads/writes the one row, seeded below.
insert into platform_marketing_settings (id) values (gen_random_uuid());

create table platform_marketing_features (
  id uuid primary key default gen_random_uuid(),
  icon text not null default '✨',
  title text not null,
  description text not null default '',
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table platform_marketing_settings enable row level security;
alter table platform_marketing_features enable row level security;

create policy platform_marketing_settings_read on platform_marketing_settings
  for select using (true);
create policy platform_marketing_settings_write_operator on platform_marketing_settings
  for all using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());

create policy platform_marketing_features_read on platform_marketing_features
  for select using (true);
create policy platform_marketing_features_write_operator on platform_marketing_features
  for all using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());

-- Resolves a company_code typed into the /:companyCode branded login link
-- to that company's existence + active status only (no other data) —
-- callable pre-auth, same "public branding lookup" trust level as
-- get_quiz_public_branding elsewhere in this app.
create or replace function public.company_exists_and_active(p_company_code text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists(
    select 1 from companies where lower(company_code) = lower(p_company_code) and active = true
  );
$$;

grant execute on function public.company_exists_and_active(text) to anon, authenticated;
