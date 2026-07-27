-- Public "Contact Us" page needs the PLATFORM OPERATOR's own business
-- contact details (email/phone/address) -- this is the platform's own
-- business identity for compliance purposes (e.g. payment gateway
-- activation), not any individual subscribing company's contact info.
-- SECURITY DEFINER + only non-sensitive fields, same pattern as
-- get_public_branding(), safe to call pre-login (anon).
create or replace function get_public_operator_contact()
returns table (
  company_name text,
  legal_name text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  country text,
  pincode text,
  website text
)
language sql
security definer
set search_path = public
as $$
  select c.company_name, c.legal_name, c.email, c.phone, c.address, c.city, c.state, c.country, c.pincode, c.website
  from companies c
  where c.is_platform_operator = true
  order by c.created_at asc
  limit 1;
$$;

grant execute on function get_public_operator_contact() to anon, authenticated;
