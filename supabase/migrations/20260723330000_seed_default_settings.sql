-- Settings only ever affects 3 real values in the whole app (login lockout
-- threshold, image/document upload size limits) - when none exist, the app
-- silently falls back to hardcoded defaults, which looks like "Settings is
-- broken / does nothing" to an admin staring at an empty "0 settings" list.
-- Seed the same 3 real values the code already falls back to, so the page
-- shows real, meaningful, editable rows instead of looking empty/dead -
-- this changes nothing about app behaviour (same defaults either way).

insert into settings (setting_key, setting_value, setting_group, description, active)
select 'max_login_attempts', '5', 'Security', 'Number of failed logins allowed before an account locks.', true
where not exists (select 1 from settings where setting_key = 'max_login_attempts');

insert into settings (setting_key, setting_value, setting_group, description, active)
select 'max_image_upload_mb', '10', 'Upload', 'Maximum size (MB) allowed for image uploads.', true
where not exists (select 1 from settings where setting_key = 'max_image_upload_mb');

insert into settings (setting_key, setting_value, setting_group, description, active)
select 'max_document_upload_mb', '25', 'Upload', 'Maximum size (MB) allowed for document uploads.', true
where not exists (select 1 from settings where setting_key = 'max_document_upload_mb');
