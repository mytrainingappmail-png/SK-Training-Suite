-- Storage usage + per-plan quota.
--
-- Every stored file is attributed to a company at READ time (no ledger to drift):
--   1. first path segment is a company id   (quiz-branding, and new course-content uploads)
--   2. first path segment is an exam session (exam-answers)
--   3. the uploader's auth user is an employee / quiz admin of a company
-- Anything else is reported as "unattributed" (older uploads made by the server).

create table if not exists storage_settings (
  id boolean primary key default true check (id),
  max_upload_mb int not null default 50 check (max_upload_mb between 1 and 5000),
  project_capacity_gb numeric not null default 1 check (project_capacity_gb > 0),
  warn_at_pct int not null default 80 check (warn_at_pct between 1 and 100)
);
insert into storage_settings (id) values (true) on conflict do nothing;
alter table storage_settings enable row level security;
-- No policies: read/written only through the RPCs below.

create or replace function storage_object_company(p_bucket text, p_name text, p_owner text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select c.id from companies c where p_name ~ '^[0-9a-fA-F-]{36}/' and c.id::text = lower(split_part(p_name, '/', 1))),
    (select es.company_id from exam_sessions es where p_bucket = 'exam-answers' and p_name ~ '^[0-9a-fA-F-]{36}/' and es.id::text = lower(split_part(p_name, '/', 1))),
    (select e.company_id from employees e where p_owner is not null and e.auth_user_id::text = p_owner limit 1),
    (select qa.company_id from quiz_admins qa where p_owner is not null and qa.auth_user_id::text = p_owner limit 1)
  );
$$;
revoke all on function storage_object_company(text, text, text) from public, anon, authenticated;

create or replace function company_storage_bytes(p_company uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
  from storage.objects o
  where storage_object_company(o.bucket_id, o.name, o.owner_id) = p_company;
$$;
revoke all on function company_storage_bytes(uuid) from public, anon, authenticated;

-- The plan's storage allowance in bytes for a company (null = no active licence found -> not limited).
create or replace function company_storage_limit_bytes(p_company uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select (sp.max_storage_gb::numeric * 1073741824)::bigint
  from company_licenses cl join subscription_plans sp on sp.id = cl.plan_id
  where cl.company_id = p_company and cl.status in ('active', 'grace_period')
  order by cl.end_date desc nulls last
  limit 1;
$$;
revoke all on function company_storage_limit_bytes(uuid) from public, anon, authenticated;

-- Used by the upload Edge Function (service role) before it accepts a file.
create or replace function storage_check_upload(p_company uuid, p_bytes bigint)
returns table (ok boolean, reason text, used_bytes bigint, limit_bytes bigint, max_upload_bytes bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_set storage_settings;
  v_used bigint;
  v_limit bigint;
begin
  select * into v_set from storage_settings where id;
  v_used := company_storage_bytes(p_company);
  v_limit := company_storage_limit_bytes(p_company);

  if p_bytes > v_set.max_upload_mb::bigint * 1048576 then
    return query select false, format('This file is larger than the %s MB upload limit. For long videos, add a YouTube/Vimeo link instead of uploading the file.', v_set.max_upload_mb), v_used, v_limit, v_set.max_upload_mb::bigint * 1048576;
  elsif v_limit is not null and v_used + p_bytes > v_limit then
    return query select false, format('Storage is full: %s of %s GB used on your plan. Delete unused files or ask your administrator to upgrade the plan.', round(v_used / 1073741824.0, 2), round(v_limit / 1073741824.0, 2)), v_used, v_limit, v_set.max_upload_mb::bigint * 1048576;
  else
    return query select true, null::text, v_used, v_limit, v_set.max_upload_mb::bigint * 1048576;
  end if;
end;
$$;
revoke all on function storage_check_upload(uuid, bigint) from public, anon, authenticated;
grant execute on function storage_check_upload(uuid, bigint) to service_role;

-- Platform operator dashboard.
create or replace function get_storage_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_set storage_settings;
  v_result jsonb;
begin
  if not current_company_is_platform_operator() then raise exception 'Not authorized.'; end if;
  select * into v_set from storage_settings where id;

  select jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'capacity_gb', v_set.project_capacity_gb,
    'max_upload_mb', v_set.max_upload_mb,
    'warn_at_pct', v_set.warn_at_pct,
    'buckets', coalesce((select jsonb_agg(jsonb_build_object('bucket', b.bucket_id, 'files', b.n, 'bytes', b.bytes) order by b.bytes desc)
        from (select bucket_id, count(*) n, coalesce(sum((metadata->>'size')::bigint), 0) bytes from storage.objects group by bucket_id) b), '[]'::jsonb),
    'companies', coalesce((select jsonb_agg(jsonb_build_object('company_id', x.cid, 'name', x.name, 'bytes', x.bytes, 'limit_bytes', company_storage_limit_bytes(x.cid)) order by x.bytes desc)
        from (select storage_object_company(o.bucket_id, o.name, o.owner_id) cid, c.company_name as name, sum((o.metadata->>'size')::bigint) bytes
              from storage.objects o left join companies c on c.id = storage_object_company(o.bucket_id, o.name, o.owner_id)
              where storage_object_company(o.bucket_id, o.name, o.owner_id) is not null
              group by 1, 2) x), '[]'::jsonb),
    'unattributed_bytes', (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o where storage_object_company(o.bucket_id, o.name, o.owner_id) is null)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function save_storage_settings(p_max_upload_mb int, p_project_capacity_gb numeric, p_warn_at_pct int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not current_company_is_platform_operator() then raise exception 'Not authorized.'; end if;
  update storage_settings set max_upload_mb = p_max_upload_mb, project_capacity_gb = p_project_capacity_gb, warn_at_pct = p_warn_at_pct where id;
end;
$$;

-- A company admin's own view: used vs plan allowance.
create or replace function get_my_storage_usage()
returns table (used_bytes bigint, limit_bytes bigint, max_upload_mb int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid := current_employee_company_id();
begin
  if v_company is null then raise exception 'Not signed in.'; end if;
  return query select company_storage_bytes(v_company), company_storage_limit_bytes(v_company), (select s.max_upload_mb from storage_settings s where s.id);
end;
$$;

revoke all on function get_storage_overview() from public, anon;
revoke all on function save_storage_settings(int, numeric, int) from public, anon;
revoke all on function get_my_storage_usage() from public, anon;
grant execute on function get_storage_overview() to authenticated;
grant execute on function save_storage_settings(int, numeric, int) to authenticated;
grant execute on function get_my_storage_usage() to authenticated;
