-- Applies the same certificate creativity built for the Quiz module to the
-- HR "Certificates" section (Certificate Templates / Certificates / Queue /
-- Verification / Bulk Issue): an independent Picture-or-Text watermark
-- (previously "Watermark (Center, Faded)" was one of the logo_position
-- choices, so picking it made the positioned logo disappear — same bug
-- fixed the same way), plus a brand-new employee photo slot with a choice
-- of 6 frame shapes, admin-attached per certificate after issuance.

alter table certificate_templates add column if not exists watermark_type text not null default 'none'
  check (watermark_type in ('none', 'logo', 'text'));
alter table certificate_templates add column if not exists watermark_text text;
alter table certificate_templates add column if not exists photo_enabled boolean not null default false;
alter table certificate_templates add column if not exists photo_frame text not null default 'circle'
  check (photo_frame in ('circle', 'square', 'rounded_square', 'hexagon', 'oval', 'polaroid'));

-- Carry forward any existing "Watermark (Center, Faded)" designs so they
-- keep looking the same: the logo becomes a logo-watermark, and the small
-- positioned logo mark falls back to top_center (it had no independent
-- position while "watermark_center" was selected).
update certificate_templates
set watermark_type = 'logo', logo_position = 'top_center'
where logo_position = 'watermark_center';

alter table certificates add column if not exists candidate_photo_url text;
