-- Commercial layer (Phase 6): make plan limits real, keep an audit trail, make
-- discount redemption safe, and support tenant offboarding.
--
-- Until now the plan limits (employees / courses / certificates per month) were
-- only shown in the UI; nothing stopped a company exceeding them. There was no
-- audit trail for who changed a licence, a role or a company setting, any
-- employee could read every promo code, and redeeming a code was a
-- read-then-write from the browser (two people could both use the last use).

-- ═══ 1. Plan limits, enforced in the database ═══════════════════════════════
-- A company with NO licence row (the platform operator's own companies, or
-- companies not onboarded onto a plan yet), an operator company, or a
-- complimentary licence is not limited. A suspended licence, or one past its end
-- date + grace period, cannot ADD employees / courses / certificates (existing
-- data and logins are untouched — it is read-only for growth, not a lockout).
create or replace function company_plan_limits(p_company_id uuid)
returns table (
  max_employees int, max_courses int, max_certificates int,
  plan_name text, blocked boolean, block_reason text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.max_employees, p.max_courses, p.max_certificates_per_month, p.plan_name,
         (cl.status = 'suspended' or (cl.end_date + cl.grace_period_days) < current_date) as blocked,
         case when cl.status = 'suspended' then 'Your subscription is suspended. Contact support to reactivate it.'
              when (cl.end_date + cl.grace_period_days) < current_date then 'Your subscription has expired. Renew it to add more.'
         end
  from company_licenses cl
  join subscription_plans p on p.id = cl.plan_id
  join companies c on c.id = cl.company_id
  where cl.company_id = p_company_id
    and cl.is_complimentary = false
    and c.is_platform_operator = false
  order by cl.end_date desc
  limit 1;
$$;
revoke all on function company_plan_limits(uuid) from public, anon;
grant execute on function company_plan_limits(uuid) to authenticated;

create or replace function enforce_employee_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_count int;
begin
  -- adding an active employee, or re-activating one
  if tg_op = 'UPDATE' and not (new.active and not old.active) then return new; end if;
  if not coalesce(new.active, true) then return new; end if;

  select * into v from company_plan_limits(new.company_id);
  if v.plan_name is null then return new; end if;
  if v.blocked then raise exception '%', v.block_reason using errcode = 'P0001'; end if;

  select count(*) into v_count from employees e
  where e.company_id = new.company_id and e.active = true and e.id is distinct from new.id;
  if v_count >= v.max_employees then
    raise exception 'Your % plan allows up to % active employees. Deactivate someone or upgrade the plan to add more.', v.plan_name, v.max_employees
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_enforce_employee_limit on employees;
create trigger trg_enforce_employee_limit before insert or update of active on employees
  for each row execute function enforce_employee_limit();

create or replace function enforce_course_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_count int;
begin
  select * into v from company_plan_limits(new.company_id);
  if v.plan_name is null then return new; end if;
  if v.blocked then raise exception '%', v.block_reason using errcode = 'P0001'; end if;
  select count(*) into v_count from courses c where c.company_id = new.company_id;
  if v_count >= v.max_courses then
    raise exception 'Your % plan allows up to % courses. Upgrade the plan to create more.', v.plan_name, v.max_courses
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_enforce_course_limit on courses;
create trigger trg_enforce_course_limit before insert on courses
  for each row execute function enforce_course_limit();

-- Certificates: one monthly budget shared by course, exam and live-quiz certificates.
create or replace function company_certificates_this_month(p_company_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select (
    (select count(*) from certificates c join employees e on e.id = c.employee_id
      where e.company_id = p_company_id and c.created_at >= date_trunc('month', now()))
  + (select count(*) from exam_certificates x where x.company_id = p_company_id and x.issued_at >= date_trunc('month', now()))
  + (select count(*) from quiz_certificates x where x.company_id = p_company_id and x.issued_at >= date_trunc('month', now()))
  )::int;
$$;
revoke all on function company_certificates_this_month(uuid) from public, anon, authenticated;

create or replace function enforce_certificate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_company uuid;
begin
  v_company := case tg_table_name
    when 'certificates' then (select e.company_id from employees e where e.id = new.employee_id)
    else new.company_id end;
  if v_company is null then return new; end if;

  select * into v from company_plan_limits(v_company);
  if v.plan_name is null then return new; end if;
  if v.blocked then raise exception '%', v.block_reason using errcode = 'P0001'; end if;
  if company_certificates_this_month(v_company) >= v.max_certificates then
    raise exception 'Your % plan allows % certificates a month and this month''s are used up. Upgrade the plan or try again next month.', v.plan_name, v.max_certificates
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_enforce_certificate_limit on certificates;
create trigger trg_enforce_certificate_limit before insert on certificates
  for each row execute function enforce_certificate_limit();
drop trigger if exists trg_enforce_certificate_limit on exam_certificates;
create trigger trg_enforce_certificate_limit before insert on exam_certificates
  for each row execute function enforce_certificate_limit();
drop trigger if exists trg_enforce_certificate_limit on quiz_certificates;
create trigger trg_enforce_certificate_limit before insert on quiz_certificates
  for each row execute function enforce_certificate_limit();

-- ═══ 2. Append-only audit trail ═════════════════════════════════════════════
create table if not exists audit_events (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  actor_auth_id uuid,
  actor_label   text,            -- employee code / quiz-admin username / 'system'
  company_id    uuid,
  table_name    text not null,
  action        text not null,   -- INSERT | UPDATE | DELETE
  row_id        text,
  old_data      jsonb,
  new_data      jsonb
);
create index if not exists audit_events_company_at_idx on audit_events (company_id, at desc);
create index if not exists audit_events_table_at_idx on audit_events (table_name, at desc);

alter table audit_events enable row level security;
revoke all on audit_events from anon, authenticated;
grant select on audit_events to authenticated;

drop policy if exists audit_events_select on audit_events;
create policy audit_events_select on audit_events for select to authenticated
  using (
    current_company_is_platform_operator()
    or (company_id = current_employee_company_id() and current_employee_is_company_admin())
  );

-- Nobody edits or deletes history — not even by accident.
create or replace function audit_events_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'The audit trail is append-only.' using errcode = '42501';
end;
$$;
drop trigger if exists trg_audit_events_immutable on audit_events;
create trigger trg_audit_events_immutable before update or delete on audit_events
  for each row execute function audit_events_immutable();

create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_company uuid;
  v_label text;
  v_keep text[];
begin
  -- employees: log only who/what/status, never personal details.
  if tg_table_name = 'employees' then
    v_keep := array['id','company_id','employee_code','active','account_locked','auth_user_id'];
    if tg_op = 'UPDATE' and
       (select jsonb_object_agg(k, v_new->k) from unnest(v_keep) k) is not distinct from
       (select jsonb_object_agg(k, v_old->k) from unnest(v_keep) k) then
      return new;  -- profile edit only: nothing sensitive changed
    end if;
    v_old := case when v_old is null then null else (select jsonb_object_agg(k, v_old->k) from unnest(v_keep) k) end;
    v_new := case when v_new is null then null else (select jsonb_object_agg(k, v_new->k) from unnest(v_keep) k) end;
  elsif tg_op = 'UPDATE' and v_old = v_new then
    return new;
  end if;

  v_company := case tg_table_name
    when 'companies' then (v_row->>'id')::uuid
    when 'employee_roles' then (select e.company_id from employees e where e.id = (v_row->>'employee_id')::uuid)
    when 'razorpay_payments' then (select cl.company_id from company_licenses cl where cl.id = (v_row->>'company_license_id')::uuid)
    else nullif(v_row->>'company_id', '')::uuid
  end;

  select coalesce(e.employee_code, qa.username, case when auth.uid() is null then 'system' end)
    into v_label
  from (select 1) one
  left join employees e on e.auth_user_id = auth.uid()
  left join quiz_admins qa on qa.auth_user_id = auth.uid()
  limit 1;

  insert into audit_events (actor_auth_id, actor_label, company_id, table_name, action, row_id, old_data, new_data)
  values (auth.uid(), v_label, v_company, tg_table_name, tg_op, v_row->>'id', v_old, v_new);

  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['companies','company_licenses','employee_roles','employees','discount_codes','razorpay_payments'] loop
    execute format('drop trigger if exists trg_audit_row_change on %I', t);
    execute format('create trigger trg_audit_row_change after insert or update or delete on %I for each row execute function audit_row_change()', t);
  end loop;
end $$;

-- ═══ 3. Discount codes: private to the operator, redeemed atomically ════════
drop policy if exists discount_codes_read on discount_codes;
create policy discount_codes_read on discount_codes for select to authenticated
  using (current_company_is_platform_operator());

create table if not exists discount_redemptions (
  id          uuid primary key default gen_random_uuid(),
  code_id     uuid not null references discount_codes(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (code_id, company_id)
);
alter table discount_redemptions enable row level security;
revoke all on discount_redemptions from anon, authenticated;
grant select on discount_redemptions to authenticated;
drop policy if exists discount_redemptions_select on discount_redemptions;
create policy discount_redemptions_select on discount_redemptions for select to authenticated
  using (current_company_is_platform_operator());

-- One company can use a code once; the use count is bumped in the same
-- statement that claims a use, so two simultaneous redemptions of the last use
-- cannot both succeed. Operator only.
create or replace function redeem_discount_code(p_code_id uuid, p_company_id uuid, p_plan_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code discount_codes;
begin
  if not current_company_is_platform_operator() then
    raise exception 'Only the platform administrator can redeem discount codes.' using errcode = '42501';
  end if;

  update discount_codes
  set times_used = times_used + 1
  where id = p_code_id and active = true
    and current_date between valid_from and valid_to
    and times_used < max_uses
    and (applicable_plan_id is null or applicable_plan_id = p_plan_id)
  returning * into v_code;
  if v_code.id is null then
    raise exception 'This code is not valid right now (inactive, expired, used up, or not for this plan).';
  end if;

  begin
    insert into discount_redemptions (code_id, company_id) values (p_code_id, p_company_id);
  exception when unique_violation then
    raise exception 'This company has already used this code.';
  end;
end;
$$;
revoke all on function redeem_discount_code(uuid, uuid, uuid) from public, anon;
grant execute on function redeem_discount_code(uuid, uuid, uuid) to authenticated;

-- ═══ 4. Notification delivery failures are kept, not lost ═══════════════════
create table if not exists notification_outbox (
  company_license_id uuid not null references company_licenses(id) on delete cascade,
  notification_type  text not null,
  attempts           integer not null default 1,
  last_error         text,
  first_failed_at    timestamptz not null default now(),
  last_attempt_at    timestamptz not null default now(),
  primary key (company_license_id, notification_type)
);
alter table notification_outbox enable row level security;
revoke all on notification_outbox from anon, authenticated;
grant select on notification_outbox to authenticated;
drop policy if exists notification_outbox_select on notification_outbox;
create policy notification_outbox_select on notification_outbox for select to authenticated
  using (current_company_is_platform_operator());

-- ═══ 5. Tenant offboarding ══════════════════════════════════════════════════
alter table companies add column if not exists offboarded_at timestamptz;

-- Soft-delete: the company can no longer sign in (active=false), nothing is
-- destroyed, and an operator can reverse it with reinstate_company().
create or replace function offboard_company(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not current_company_is_platform_operator() then
    raise exception 'Only the platform administrator can offboard a company.' using errcode = '42501';
  end if;
  if exists (select 1 from companies where id = p_company_id and is_platform_operator) then
    raise exception 'The platform operator''s own company cannot be offboarded.';
  end if;
  update companies set active = false, offboarded_at = now() where id = p_company_id;
  if not found then raise exception 'Company not found.'; end if;
end;
$$;

create or replace function reinstate_company(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not current_company_is_platform_operator() then
    raise exception 'Only the platform administrator can reinstate a company.' using errcode = '42501';
  end if;
  update companies set active = true, offboarded_at = null where id = p_company_id;
  if not found then raise exception 'Company not found.'; end if;
end;
$$;

-- A portable copy of a company's core records for handing back on exit.
create or replace function export_company_data(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not current_company_is_platform_operator() then
    raise exception 'Only the platform administrator can export company data.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'company', (select to_jsonb(c) from companies c where c.id = p_company_id),
    'branches', coalesce((select jsonb_agg(to_jsonb(b)) from branches b where b.company_id = p_company_id), '[]'::jsonb),
    'departments', coalesce((select jsonb_agg(to_jsonb(d)) from departments d where d.company_id = p_company_id), '[]'::jsonb),
    'employees', coalesce((select jsonb_agg(jsonb_build_object(
        'employee_code', e.employee_code, 'first_name', e.first_name, 'last_name', e.last_name,
        'email', e.email, 'mobile', e.mobile, 'joining_date', e.joining_date, 'active', e.active))
      from employees e where e.company_id = p_company_id), '[]'::jsonb),
    'courses', coalesce((select jsonb_agg(jsonb_build_object(
        'course_code', c.course_code, 'course_name', c.course_name, 'short_description', c.short_description,
        'level', c.level, 'active', c.active))
      from courses c where c.company_id = p_company_id), '[]'::jsonb)
  );
end;
$$;

revoke all on function offboard_company(uuid), reinstate_company(uuid), export_company_data(uuid) from public, anon;
grant execute on function offboard_company(uuid), reinstate_company(uuid), export_company_data(uuid) to authenticated;
