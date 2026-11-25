-- Company backups: a full copy of a company's data (everything the app keeps for it), made on demand or automatically every
-- week, kept in a private storage bucket, downloadable, and restorable.
--
-- "Automatically includes new features": nothing here lists the app's tables by hand. A backup walks the database's own catalog:
-- every table that has a company_id column belongs to the company, and every table that points (foreign key) at a table that
-- belongs to the company belongs to it too, and so on down the chain. A table created for any future feature is therefore
-- backed up the moment it exists. Tables that are only logs / caches / queues are skipped (see _backup_skip_tables). The
-- platform owner's company also gets the tables that belong to nobody (shop, help articles, marketing...).
--
-- Restore is safe by default: it only brings back what is MISSING (never overwrites, never deletes). An optional mode also puts
-- edited items back to their backed-up version, but never for people / accounts / billing. Logins are not restored (they live in
-- the auth system), and rows that would point at something that no longer exists are dropped so nothing broken is left behind.
-- The functions are for the server only (service role); the app reaches them through the company-backup edge functions.

create table if not exists public.company_backups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('manual', 'weekly', 'before_restore')),
  created_at timestamptz not null default now(),
  created_by uuid references public.employees(id) on delete set null,
  file_path text not null,
  size_bytes bigint not null default 0,
  row_counts jsonb not null default '{}'::jsonb,
  note text
);
create index if not exists idx_company_backups_company on public.company_backups (company_id, created_at desc);

create table if not exists public.company_backup_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  weekly_enabled boolean not null default true,
  keep_count integer not null default 8 check (keep_count between 1 and 52),
  notify_email text,
  last_weekly_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.company_backups enable row level security;
alter table public.company_backup_settings enable row level security;

drop policy if exists company_backups_select on public.company_backups;
create policy company_backups_select on public.company_backups
  for select using (company_id = current_employee_company_id() and current_employee_is_company_admin());

drop policy if exists company_backup_settings_select on public.company_backup_settings;
create policy company_backup_settings_select on public.company_backup_settings
  for select using (company_id = current_employee_company_id() and current_employee_is_company_admin());
drop policy if exists company_backup_settings_insert on public.company_backup_settings;
create policy company_backup_settings_insert on public.company_backup_settings
  for insert with check (company_id = current_employee_company_id() and current_employee_is_company_admin());
drop policy if exists company_backup_settings_update on public.company_backup_settings;
create policy company_backup_settings_update on public.company_backup_settings
  for update using (company_id = current_employee_company_id() and current_employee_is_company_admin())
  with check (company_id = current_employee_company_id() and current_employee_is_company_admin());

-- The private bucket: downloads go through signed links made by the edge function; an admin may upload a backup file from their
-- computer into their own company's uploads folder (to restore from it).
insert into storage.buckets (id, name, public) values ('company-backups', 'company-backups', false) on conflict (id) do nothing;

drop policy if exists company_backups_upload on storage.objects;
create policy company_backups_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-backups'
    and (storage.foldername(name))[1] = current_employee_company_id()::text
    and (storage.foldername(name))[2] = 'uploads'
    and current_employee_is_company_admin()
  );

-- ── what is never backed up ────────────────────────────────────────────────────
create or replace function public._backup_skip_tables() returns text[]
language sql immutable as $$
  select array[
    'company_backups', 'company_backup_settings',                      -- the backups themselves
    'audit_events', 'client_errors', 'edge_rate_limits',               -- logs
    'translation_cache', 'translation_usage', 'ai_quiz_generations',   -- caches / usage counters
    'notification_outbox', 'certificate_generation_queue'              -- queues
  ]::text[];
$$;

-- never restored (logins live in the auth system; billing / plans / permissions are not something a restore should touch)
create or replace function public._backup_no_restore_tables() returns text[]
language sql immutable as $$
  select array[
    'companies', 'employees', 'users', 'user_roles', 'employee_roles', 'roles', 'role_permissions', 'permissions',
    'company_licenses', 'company_modules', 'subscription_plans', 'plan_modules', 'platform_payments', 'razorpay_payments',
    'discount_codes', 'discount_redemptions', 'app_modules', 'menus', 'menu_permissions'
  ]::text[];
$$;

-- ── which tables, and which rows of each, belong to a company ─────────────────────────────
create or replace function public._backup_scope(p_company uuid)
returns table (tbl text, where_sql text, pk_cols text[])
language plpgsql stable security definer set search_path = public as $$
declare
  v_platform boolean := coalesce((select is_platform_operator from public.companies where id = p_company), false);
  v_scope jsonb := '{}'::jsonb;
  v_changed boolean := true;
  v_pass integer := 0;
  t record; fk record;
begin
  -- 1) tables that carry company_id (and the company's own row)
  for t in
    select c.table_name::text as name from information_schema.columns c
      join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name and x.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.column_name = 'company_id' and not (c.table_name = any (_backup_skip_tables()))
  loop
    v_scope := v_scope || jsonb_build_object(t.name, format('company_id = %L', p_company));
  end loop;
  v_scope := v_scope || jsonb_build_object('companies', format('id = %L', p_company));

  -- 2) tables that point at an already-scoped table (repeated until nothing new is found)
  while v_changed and v_pass < 10 loop
    v_changed := false; v_pass := v_pass + 1;
    for fk in
      select cl.relname::text as child, a.attname::text as child_col, pl.relname::text as parent, pa.attname::text as parent_pk
        from pg_constraint c
        join pg_class cl on cl.oid = c.conrelid join pg_namespace cn on cn.oid = cl.relnamespace and cn.nspname = 'public'
        join pg_class pl on pl.oid = c.confrelid join pg_namespace pn on pn.oid = pl.relnamespace and pn.nspname = 'public'
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
       where c.contype = 'f' and array_length(c.conkey, 1) = 1 and cl.relkind = 'r'
       order by cl.relname, a.attnum
    loop
      continue when v_scope ? fk.child;
      continue when fk.child = any (_backup_skip_tables());
      continue when not (v_scope ? fk.parent);
      v_scope := v_scope || jsonb_build_object(fk.child, format('%I in (select %I from public.%I where %s)', fk.child_col, fk.parent_pk, fk.parent, v_scope ->> fk.parent));
      v_changed := true;
    end loop;
  end loop;

  -- 3) tables that belong to nobody: only the platform owner's backup takes them
  if v_platform then
    for t in
      select x.table_name::text as name from information_schema.tables x
       where x.table_schema = 'public' and x.table_type = 'BASE TABLE' and not (x.table_name = any (_backup_skip_tables()))
    loop
      if not (v_scope ? t.name) then v_scope := v_scope || jsonb_build_object(t.name, 'true'); end if;
    end loop;
  end if;

  return query
    select k.key::text, k.value #>> '{}',
           (select array_agg(a.attname::text order by array_position(i.indkey::int2[], a.attnum))
              from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
             where i.indrelid = to_regclass('public.' || quote_ident(k.key)) and i.indisprimary)
      from jsonb_each(v_scope) k
     order by k.key;
end $$;

-- ── make a backup (rows of every table of the company as one JSON document) ─────────────────────
create or replace function public.backup_company_data(p_company uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record; v_rows jsonb; v_tables jsonb := '{}'::jsonb; v_counts jsonb := '{}'::jsonb; v_n integer;
begin
  perform set_config('statement_timeout', '600000', true);
  if not exists (select 1 from public.companies where id = p_company) then raise exception 'company not found'; end if;
  for r in select * from public._backup_scope(p_company) loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb), count(*) from public.%I t where %s', r.tbl, r.where_sql) into v_rows, v_n;
    if v_n > 0 then
      v_tables := v_tables || jsonb_build_object(r.tbl, v_rows);
      v_counts := v_counts || jsonb_build_object(r.tbl, v_n);
    end if;
  end loop;
  return jsonb_build_object(
    'format', 'company-backup', 'version', 1, 'company_id', p_company,
    'company_code', (select company_code from public.companies where id = p_company),
    'created_at', now(), 'row_counts', v_counts, 'tables', v_tables);
end $$;

-- ── restore ───────────────────────────────────────────────────────────────────
-- p_overwrite = false: only rows that are missing are brought back. true: rows that exist are also set back to their backed-up
-- version (never for the tables in _backup_no_restore_tables()).
create or replace function public.restore_company_data(p_company uuid, p_tables jsonb, p_overwrite boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record; fk record;
  v_cols text; v_set text; v_pk text; v_guard text; v_sql text;
  v_new integer; v_upd integer; v_err integer; v_summary jsonb := '{}'::jsonb; v_touched text[] := '{}';
  v_orphans jsonb := '{}'::jsonb; v_pass integer; v_changed boolean; v_n integer; v_row jsonb; v_has_company boolean;
begin
  perform set_config('statement_timeout', '900000', true);
  -- no triggers (no certificates issued, no limits checked, no "updated" stamps) and no foreign-key checks while rows go back
  execute 'set local session_replication_role = replica';

  for r in select * from public._backup_scope(p_company) loop
    continue when not (p_tables ? r.tbl) or jsonb_typeof(p_tables -> r.tbl) <> 'array' or jsonb_array_length(p_tables -> r.tbl) = 0;
    continue when r.tbl = any (public._backup_no_restore_tables());
    if r.pk_cols is null then v_summary := v_summary || jsonb_build_object(r.tbl, jsonb_build_object('skipped', 'no primary key')); continue; end if;

    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_cols
      from pg_attribute a where a.attrelid = to_regclass('public.' || quote_ident(r.tbl)) and a.attnum > 0 and not a.attisdropped and a.attgenerated = '';
    select string_agg(quote_ident(k), ', ') into v_pk from unnest(r.pk_cols) k;
    select string_agg(format('%1$I = excluded.%1$I', a.attname), ', ' order by a.attnum) into v_set
      from pg_attribute a where a.attrelid = to_regclass('public.' || quote_ident(r.tbl)) and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
       and not (a.attname = any (r.pk_cols));
    v_has_company := exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = r.tbl and column_name = 'company_id');
    -- a row that names another company is never restored here
    v_guard := case when v_has_company then format('where x.company_id = %L', p_company) else '' end;

    v_new := 0; v_upd := 0; v_err := 0;
    begin
      if p_overwrite and v_set is not null then
        v_sql := format('with ins as (insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I, $1) x %3$s on conflict (%4$s) do update set %5$s where to_jsonb(%1$I) is distinct from to_jsonb(excluded) returning (xmax = 0) as is_new) select count(*) filter (where is_new), count(*) filter (where not is_new) from ins',
                        r.tbl, v_cols, v_guard, v_pk, v_set);
      else
        v_sql := format('with ins as (insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I, $1) x %3$s on conflict do nothing returning true as is_new) select count(*) filter (where is_new), 0::bigint from ins',
                        r.tbl, v_cols, v_guard);
      end if;
      execute v_sql into v_new, v_upd using (p_tables -> r.tbl);
    exception when others then
      -- one bad row must not stop the table: go row by row and count what could not be put back
      v_new := 0; v_upd := 0; v_err := 0;
      for v_row in select * from jsonb_array_elements(p_tables -> r.tbl) loop
        begin
          execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) x %3$s on conflict do nothing', r.tbl, v_cols, v_guard) using v_row;
          get diagnostics v_n = row_count;
          v_new := v_new + v_n;
        exception when others then v_err := v_err + 1;
        end;
      end loop;
    end;
    if v_new + v_upd > 0 then v_touched := v_touched || r.tbl; end if;
    if v_new + v_upd + v_err > 0 then
      v_summary := v_summary || jsonb_build_object(r.tbl, jsonb_build_object('brought_back', v_new, 'reset_to_backup', v_upd, 'failed', v_err));
    end if;
  end loop;

  -- rows that would point at something that no longer exists: clear an optional link, drop a row that cannot live without it
  v_pass := 0; v_changed := true;
  while v_changed and v_pass < 6 loop
    v_changed := false; v_pass := v_pass + 1;
    for fk in
      select cl.relname::text as child, a.attname::text as child_col, pl.relname::text as parent, pa.attname::text as parent_pk, a.attnotnull as not_null
        from pg_constraint c
        join pg_class cl on cl.oid = c.conrelid join pg_namespace cn on cn.oid = cl.relnamespace and cn.nspname = 'public'
        join pg_class pl on pl.oid = c.confrelid join pg_namespace pn on pn.oid = pl.relnamespace and pn.nspname = 'public'
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
       where c.contype = 'f' and array_length(c.conkey, 1) = 1 and cl.relkind = 'r' and cl.relname = any (v_touched)
    loop
      if fk.not_null then
        execute format('delete from public.%1$I c where c.%2$I is not null and not exists (select 1 from public.%3$I p where p.%4$I = c.%2$I)', fk.child, fk.child_col, fk.parent, fk.parent_pk);
      else
        execute format('update public.%1$I c set %2$I = null where c.%2$I is not null and not exists (select 1 from public.%3$I p where p.%4$I = c.%2$I)', fk.child, fk.child_col, fk.parent, fk.parent_pk);
      end if;
      get diagnostics v_n = row_count;
      if v_n > 0 then
        v_changed := true;
        v_orphans := v_orphans || jsonb_build_object(fk.child, coalesce((v_orphans ->> fk.child)::integer, 0) + v_n);
      end if;
    end loop;
  end loop;

  return jsonb_build_object('tables', v_summary, 'dropped_or_cleared_links', v_orphans, 'overwrite', p_overwrite);
end $$;

revoke all on function public._backup_scope(uuid) from public, anon, authenticated;
revoke all on function public.backup_company_data(uuid) from public, anon, authenticated;
revoke all on function public.restore_company_data(uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public._backup_scope(uuid) to service_role;
grant execute on function public.backup_company_data(uuid) to service_role;
grant execute on function public.restore_company_data(uuid, jsonb, boolean) to service_role;

-- ── the weekly run: every Sunday evening UTC (Monday 02:30 IST), through the same secret the licence job already uses ──────────
select
  cron.schedule(
    'company-weekly-backup',
    '0 21 * * 0',
    $$
    select net.http_post(
      url := 'https://psxbxbbspkteiczojajh.supabase.co/functions/v1/company-backup-weekly',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'license_scheduler_service_role_key')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
    $$
  )
where not exists (select 1 from cron.job where jobname = 'company-weekly-backup');
