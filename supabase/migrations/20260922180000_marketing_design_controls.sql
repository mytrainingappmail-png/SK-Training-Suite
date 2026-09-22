-- Self-service look-and-feel for the public marketing homepage — colors, backgrounds and
-- alignment the platform operator can change themselves (Admin -> Platform Configuration ->
-- Marketing Website -> Design), instead of asking for a code change every time.

alter table platform_marketing_settings add column if not exists accent_from text not null default '#4F46E5';
alter table platform_marketing_settings add column if not exists accent_to text not null default '#7C3AED';
alter table platform_marketing_settings add column if not exists hero_bg_from text not null default '#1E1B4B';
alter table platform_marketing_settings add column if not exists hero_bg_to text not null default '#020617';
alter table platform_marketing_settings add column if not exists hero_align text not null default 'center' check (hero_align in ('left', 'center'));
alter table platform_marketing_settings add column if not exists about_bg_from text not null default '#020617';
alter table platform_marketing_settings add column if not exists about_bg_to text not null default '#1E1B4B';
alter table platform_marketing_settings add column if not exists about_text_light boolean not null default true;
alter table platform_marketing_settings add column if not exists logo_scale int not null default 100 check (logo_scale between 50 and 300);
alter table platform_marketing_settings add column if not exists hero_image_url text;
alter table platform_marketing_settings add column if not exists about_photo_url text;
alter table platform_marketing_settings add column if not exists about_photo_frame text not null default 'circle'
  check (about_photo_frame in ('circle', 'square', 'rounded_square', 'hexagon', 'oval', 'polaroid'));

-- The public pricing/features RPCs are untouched; this page's own public read RPC needs the
-- new columns exposed the same way everything else on the settings row already is.
