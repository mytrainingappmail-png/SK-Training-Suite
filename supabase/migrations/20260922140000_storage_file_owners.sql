-- Server uploads (service role) have no owner on storage.objects, and the existing Storage
-- Manager only lists images/ videos/ documents/ - so files must keep those paths. Instead the
-- upload Edge Function records which company each file belongs to here.

create table if not exists storage_file_owners (
  bucket_id text not null,
  name text not null,
  company_id uuid not null references companies(id) on delete cascade,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  primary key (bucket_id, name)
);
alter table storage_file_owners enable row level security;
-- No policies: written by the Edge Function (service role), read inside security-definer functions.

create or replace function storage_object_company(p_bucket text, p_name text, p_owner text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select f.company_id from storage_file_owners f where f.bucket_id = p_bucket and f.name = p_name),
    (select c.id from companies c where p_name ~ '^[0-9a-fA-F-]{36}/' and c.id::text = lower(split_part(p_name, '/', 1))),
    (select es.company_id from exam_sessions es where p_bucket = 'exam-answers' and p_name ~ '^[0-9a-fA-F-]{36}/' and es.id::text = lower(split_part(p_name, '/', 1))),
    (select e.company_id from employees e where p_owner is not null and e.auth_user_id::text = p_owner limit 1),
    (select qa.company_id from quiz_admins qa where p_owner is not null and qa.auth_user_id::text = p_owner limit 1)
  );
$$;
revoke all on function storage_object_company(text, text, text) from public, anon, authenticated;
