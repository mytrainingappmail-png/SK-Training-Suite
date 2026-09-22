-- Pricing: monthly price is now the one number an admin types. Yearly (and an optional
-- 6-month) price are ALWAYS derived from it via a discount %, so they can never drift out
-- of sync with the monthly price the way two independently-typed numbers could.

alter table subscription_plans add column if not exists yearly_discount_pct numeric not null default 0 check (yearly_discount_pct between 0 and 100);
alter table subscription_plans add column if not exists six_month_discount_pct numeric check (six_month_discount_pct between 0 and 100);
comment on column subscription_plans.six_month_discount_pct is 'null = the 6-month billing option is not offered for this plan.';

-- Backfill from whatever price_yearly already held, so today's live prices don't jump.
update subscription_plans
set yearly_discount_pct = case
  when price_monthly <= 0 or price_yearly <= 0 then 0
  else greatest(0, least(100, round((1 - price_yearly::numeric / (price_monthly * 12)) * 100)))
end;

-- price_yearly/price_six_month become GENERATED columns: always monthly x months x (1 - discount%),
-- so the UI only ever collects price_monthly + the discount %s and these can't be edited directly.
alter table subscription_plans drop column price_yearly;
alter table subscription_plans add column price_yearly numeric generated always as (round(price_monthly * 12 * (1 - yearly_discount_pct / 100.0), 2)) stored;
alter table subscription_plans add column price_six_month numeric generated always as (
  case when six_month_discount_pct is null then null else round(price_monthly * 6 * (1 - six_month_discount_pct / 100.0), 2) end
) stored;

-- Public pricing page needs the new columns too (DROP first: adding columns changes the
-- return signature, which CREATE OR REPLACE FUNCTION cannot do).
drop function if exists public.get_public_subscription_plans();
create or replace function public.get_public_subscription_plans()
returns table (
  id uuid, plan_name text, plan_code text, description text,
  max_employees int, max_courses int, max_storage_gb int, max_certificates_per_month int,
  price_monthly numeric, price_yearly numeric, yearly_discount_pct numeric,
  price_six_month numeric, six_month_discount_pct numeric, features text
)
language sql stable security definer
set search_path = public
as $$
  select id, plan_name, plan_code, description, max_employees, max_courses,
         max_storage_gb, max_certificates_per_month, price_monthly, price_yearly, yearly_discount_pct,
         price_six_month, six_month_discount_pct, features
  from subscription_plans
  where active = true
  order by price_monthly asc;
$$;
grant execute on function public.get_public_subscription_plans() to anon, authenticated;

-- One feature a plan includes, with its explanation — sourced straight from the same
-- app_modules registry (key/label/description) that already drives Company Modules and the
-- Plan editor's "Modules Included" checklist, so there is exactly one place these are written.
create or replace function public.get_public_plan_features()
returns table (plan_id uuid, module_key text, label text, description text, is_addon boolean, display_order int)
language sql stable security definer
set search_path = public
as $$
  select p.id, m.key, m.label, m.description, m.is_addon, m.display_order
  from subscription_plans p
  join app_modules m on true
  left join plan_modules pm on pm.plan_id = p.id and pm.module_key = m.key
  where p.active = true and coalesce(pm.enabled, m.default_enabled) = true
  order by p.price_monthly asc, m.display_order asc;
$$;
grant execute on function public.get_public_plan_features() to anon, authenticated;

-- Payment amount now honours all three cycles (was: yearly vs monthly only).
create or replace function get_public_license_payment_info(p_license_id uuid)
returns table (
  company_id uuid, company_name text, company_email text, plan_id uuid, plan_name text,
  amount_in_rupees numeric, billing_cycle text, status text
)
language sql
security definer
set search_path = public
as $$
  select
    c.id, c.company_name, c.email, p.id, p.plan_name,
    case cl.billing_cycle
      when 'yearly' then p.price_yearly
      when 'six_month' then coalesce(p.price_six_month, p.price_monthly * 6)
      else p.price_monthly
    end,
    cl.billing_cycle, cl.status
  from company_licenses cl
  join companies c on c.id = cl.company_id
  join subscription_plans p on p.id = cl.plan_id
  where cl.id = p_license_id;
$$;
grant execute on function get_public_license_payment_info(uuid) to anon, authenticated;
