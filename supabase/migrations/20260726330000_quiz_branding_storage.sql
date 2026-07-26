-- Executive Dashboard request also included: real logo/login-image upload
-- (Settings currently only accepts a pasted URL) and branding on the quiz
-- admin login page. Adds the two missing quiz_settings columns, a public
-- Storage bucket for the uploaded images, and a pre-auth branding lookup —
-- mirrors the LMS's own get_public_branding() pattern (company-code driven
-- there; here the quiz-admin login has no company code at all — global
-- unique usernames — so it falls back to the same "first company with the
-- module enabled" default the LMS uses when no code has been typed yet).

alter table quiz_settings add column if not exists login_background_url text;
alter table quiz_settings add column if not exists login_banner_url text;

insert into storage.buckets (id, name, public)
values ('quiz-branding', 'quiz-branding', true)
on conflict (id) do nothing;

drop policy if exists quiz_branding_public_read on storage.objects;
create policy quiz_branding_public_read on storage.objects
  for select using (bucket_id = 'quiz-branding');

-- Path convention: {company_id}/{kind}-{timestamp}.{ext} — the first path
-- segment must equal the uploading admin's own company_id, and only an
-- editing admin (not view_only) may write.
drop policy if exists quiz_branding_admin_write on storage.objects;
create policy quiz_branding_admin_write on storage.objects
  for insert with check (
    bucket_id = 'quiz-branding'
    and (storage.foldername(name))[1] = current_quiz_admin_company_id()::text
    and current_quiz_admin_can_edit()
  );

drop policy if exists quiz_branding_admin_update on storage.objects;
create policy quiz_branding_admin_update on storage.objects
  for update using (
    bucket_id = 'quiz-branding'
    and (storage.foldername(name))[1] = current_quiz_admin_company_id()::text
    and current_quiz_admin_can_edit()
  );

drop policy if exists quiz_branding_admin_delete on storage.objects;
create policy quiz_branding_admin_delete on storage.objects
  for delete using (
    bucket_id = 'quiz-branding'
    and (storage.foldername(name))[1] = current_quiz_admin_company_id()::text
    and current_quiz_admin_can_edit()
  );

create or replace function get_quiz_public_branding()
returns table (
  company_name text,
  brand_name text,
  brand_tagline text,
  brand_logo_url text,
  login_background_url text,
  login_banner_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.company_name, s.brand_name, s.brand_tagline, s.brand_logo_url, s.login_background_url, s.login_banner_url
  from companies c
  left join quiz_settings s on s.company_id = c.id
  where c.live_quiz_enabled = true
  order by c.created_at asc
  limit 1;
$$;

grant execute on function get_quiz_public_branding() to anon, authenticated;
