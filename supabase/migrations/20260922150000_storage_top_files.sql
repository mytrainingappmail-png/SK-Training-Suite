-- Adds "biggest files" (with owning client) to the storage overview so space hogs are easy to find.

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
    'unattributed_bytes', (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o where storage_object_company(o.bucket_id, o.name, o.owner_id) is null),
    'top_files', coalesce((select jsonb_agg(jsonb_build_object('bucket', t.bucket_id, 'name', t.name, 'bytes', t.bytes, 'created_at', t.created_at, 'client', t.client) order by t.bytes desc)
        from (select o.bucket_id, o.name, (o.metadata->>'size')::bigint bytes, o.created_at,
                     (select c.company_name from companies c where c.id = storage_object_company(o.bucket_id, o.name, o.owner_id)) client
              from storage.objects o where o.metadata->>'size' is not null
              order by (o.metadata->>'size')::bigint desc limit 10) t), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
