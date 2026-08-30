-- Phase 2/3 of the public marketing homepage: testimonials, public
-- pricing (from the existing subscription_plans table), and a lead
-- capture inquiry form (trial requests / general queries / contact).

create table platform_marketing_testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role_or_company text,
  quote text not null,
  photo_url text,
  rating int not null default 5 check (rating between 1 and 5),
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table platform_marketing_testimonials enable row level security;

create policy platform_marketing_testimonials_read on platform_marketing_testimonials
  for select using (true);
create policy platform_marketing_testimonials_write_operator on platform_marketing_testimonials
  for all using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());

-- Exposes only active plans' public-facing fields — subscription_plans
-- itself stays authenticated-only (subscription_plans_read requires
-- auth.uid() is not null), this is a narrow, read-only, pre-auth window
-- into just the pricing-page-safe columns.
create or replace function public.get_public_subscription_plans()
returns table (
  id uuid, plan_name text, plan_code text, description text,
  max_employees int, max_courses int, max_storage_gb int, max_certificates_per_month int,
  price_monthly numeric, price_yearly numeric, features text
)
language sql stable security definer
set search_path = public
as $$
  select id, plan_name, plan_code, description, max_employees, max_courses,
         max_storage_gb, max_certificates_per_month, price_monthly, price_yearly, features
  from subscription_plans
  where active = true
  order by price_monthly asc;
$$;

grant execute on function public.get_public_subscription_plans() to anon, authenticated;

-- Lead capture: trial requests, contact/query form submissions. Public
-- INSERT-only — a visitor can create their own inquiry but can never
-- read, edit, or delete any inquiry (their own or anyone else's).
-- Only the platform operator can view/manage the list.
create table platform_marketing_inquiries (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'query' check (source in ('trial', 'query')),
  name text not null,
  company_name text,
  phone text,
  email text,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table platform_marketing_inquiries enable row level security;

create policy platform_marketing_inquiries_public_insert on platform_marketing_inquiries
  for insert with check (true);
create policy platform_marketing_inquiries_operator_manage on platform_marketing_inquiries
  for all using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
