-- Powers a public, no-login "Pay Now" page (/pay/:licenseId) that a
-- platform operator can send a company via email/WhatsApp to collect an
-- online payment for their subscription -- the payer is an external
-- company contact, not someone with an LMS login, so this can't go
-- through the normal company-scoped RLS policies. SECURITY DEFINER,
-- returns only what the payment page needs to render (no other company's
-- data, no internal fields).
create or replace function get_public_license_payment_info(p_license_id uuid)
returns table (
  company_id uuid,
  company_name text,
  company_email text,
  plan_id uuid,
  plan_name text,
  amount_in_rupees numeric,
  billing_cycle text,
  status text
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.company_name,
    c.email,
    p.id,
    p.plan_name,
    case when cl.billing_cycle = 'yearly' then p.price_yearly else p.price_monthly end,
    cl.billing_cycle,
    cl.status
  from company_licenses cl
  join companies c on c.id = cl.company_id
  join subscription_plans p on p.id = cl.plan_id
  where cl.id = p_license_id;
$$;

grant execute on function get_public_license_payment_info(uuid) to anon, authenticated;
