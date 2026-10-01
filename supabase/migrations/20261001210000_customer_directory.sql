-- Customer Directory (platform owner only).
--
-- One live view of every company on the platform: how to sign in, who the admins
-- are, licence number / plan / status / expiry, usage against plan limits, last
-- activity, money received, and the owner's private follow-up notes. It is read
-- straight from the live tables, so a company added tomorrow appears by itself.
--
-- Passwords are never stored anywhere, so they cannot be listed; the owner can set
-- a fresh temporary password for a company's administrator from the directory.

-- ═══ Manual payment ledger (UPI / bank / cash — Razorpay is tracked separately) ═══
create table if not exists platform_payments (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  paid_on    date not null default current_date,
  amount     numeric(12, 2) not null check (amount > 0),
  method     text not null default 'upi' check (method in ('upi', 'bank', 'cash', 'cheque', 'razorpay', 'other')),
  reference  text,
  note       text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index if not exists idx_platform_payments_company on platform_payments (company_id, paid_on desc);

-- ═══ Owner's private notes / follow-ups per company ═══
create table if not exists platform_company_notes (
  company_id     uuid primary key references companies(id) on delete cascade,
  note           text,
  follow_up_date date,
  updated_at     timestamptz not null default now()
);

alter table platform_payments enable row level security;
alter table platform_company_notes enable row level security;
revoke all on platform_payments, platform_company_notes from anon;

drop policy if exists platform_payments_owner on platform_payments;
create policy platform_payments_owner on platform_payments for all to authenticated
  using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());

drop policy if exists platform_company_notes_owner on platform_company_notes;
create policy platform_company_notes_owner on platform_company_notes for all to authenticated
  using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());

-- changes to the ledger go into the append-only audit trail too
drop trigger if exists trg_audit_row_change on platform_payments;
create trigger trg_audit_row_change after insert or update or delete on platform_payments
  for each row execute function audit_row_change();

-- ═══ The directory itself ═══
create or replace function get_company_directory()
returns table (
  company_id uuid, company_code text, company_name text, short_name text,
  company_email text, company_phone text, city text, state text,
  company_active boolean, offboarded_at timestamptz, is_platform_operator boolean, created_at timestamptz,
  admins jsonb,
  licence_id uuid, licence_no text, plan_name text, plan_code text, billing_cycle text,
  licence_status text, effective_status text,
  start_date date, end_date date, days_left integer, grace_period_days integer, is_complimentary boolean,
  plan_price numeric,
  employees_active integer, employees_total integer, max_employees integer,
  courses integer, max_courses integer,
  certificates_this_month integer, max_certificates integer,
  storage_mb numeric,
  last_login timestamptz,
  paid_total numeric, payments_count integer, last_payment_on date,
  failed_reminders integer,
  note text, follow_up_date date, note_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not current_company_is_platform_operator() then
    raise exception 'Only the platform owner can open the customer directory.' using errcode = '42501';
  end if;

  return query
  select
    c.id, c.company_code::text, c.company_name::text, c.short_name::text,
    c.email::text, c.phone::text, c.city::text, c.state::text,
    c.active, c.offboarded_at, c.is_platform_operator, c.created_at,

    coalesce((
      select jsonb_agg(jsonb_build_object(
               'employee_code', e.employee_code,
               'name', trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')),
               'email', e.email,
               'mobile', e.mobile,
               'has_login', e.auth_user_id is not null,
               'auth_user_id', e.auth_user_id,
               'last_login', e.last_login,
               'active', e.active) order by e.employee_code)
      from employees e
      join employee_roles er on er.employee_id = e.id and er.active = true
      join roles r on r.id = er.role_id and r.role_code = 'SUPER_ADMIN' and r.company_id = c.id
      where e.company_id = c.id
    ), '[]'::jsonb),

    l.id,
    case when l.id is null then null else 'LIC-' || upper(substr(replace(l.id::text, '-', ''), 1, 8)) end,
    p.plan_name::text, p.plan_code::text, l.billing_cycle::text,
    l.status::text,
    case
      when l.id is null then 'no_licence'
      when l.status = 'suspended' then 'suspended'
      when l.is_complimentary then 'complimentary'
      when l.end_date >= current_date then 'active'
      when l.end_date + l.grace_period_days >= current_date then 'grace'
      else 'expired'
    end,
    l.start_date, l.end_date, (l.end_date - current_date)::int, l.grace_period_days, l.is_complimentary,
    case l.billing_cycle
      when 'yearly' then p.price_yearly
      when 'six_month' then coalesce(p.price_six_month, p.price_monthly * 6)
      else p.price_monthly
    end::numeric,

    (select count(*)::int from employees e where e.company_id = c.id and e.active = true),
    (select count(*)::int from employees e where e.company_id = c.id),
    p.max_employees,
    (select count(*)::int from courses cr where cr.company_id = c.id),
    p.max_courses,
    company_certificates_this_month(c.id),
    p.max_certificates_per_month,

    coalesce((
      select round(sum((o.metadata ->> 'size')::numeric) / 1048576.0, 1)
      from storage_file_owners fo
      join storage.objects o on o.bucket_id = fo.bucket_id and o.name = fo.name
      where fo.company_id = c.id
    ), 0),

    (select max(e.last_login) from employees e where e.company_id = c.id),

    coalesce((select sum(pp.amount) from platform_payments pp where pp.company_id = c.id), 0)
      + coalesce((select sum(rp.amount_paise) / 100.0 from razorpay_payments rp
                  join company_licenses cl on cl.id = rp.company_license_id
                  where cl.company_id = c.id and rp.status = 'renewed'), 0),
    (select count(*)::int from platform_payments pp where pp.company_id = c.id)
      + (select count(*)::int from razorpay_payments rp join company_licenses cl on cl.id = rp.company_license_id
         where cl.company_id = c.id and rp.status = 'renewed'),
    (select max(pp.paid_on) from platform_payments pp where pp.company_id = c.id),

    (select count(*)::int from notification_outbox nb join company_licenses cl on cl.id = nb.company_license_id where cl.company_id = c.id),

    n.note, n.follow_up_date, n.updated_at
  from companies c
  left join lateral (
    select * from company_licenses cl where cl.company_id = c.id order by cl.end_date desc limit 1
  ) l on true
  left join subscription_plans p on p.id = l.plan_id
  left join platform_company_notes n on n.company_id = c.id
  order by c.is_platform_operator desc, c.company_name;
end;
$$;

revoke all on function get_company_directory() from public, anon;
grant execute on function get_company_directory() to authenticated;
