-- Employees can have a profile photo (saved from the profile drawer).
alter table employees add column if not exists profile_image_url text;
