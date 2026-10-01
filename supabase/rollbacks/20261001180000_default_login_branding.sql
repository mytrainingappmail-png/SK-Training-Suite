-- Rollback: previous definition
CREATE OR REPLACE FUNCTION public.get_public_branding(p_company_code text DEFAULT NULL::text)
 RETURNS TABLE(company_name text, logo text, login_logo_url text, app_icon_url text, favicon text, company_code text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.company_name, c.logo, c.login_logo_url, c.app_icon_url, c.favicon, c.company_code
  from companies c
  where c.active = true
    and c.id = coalesce(
      (select id from companies where active = true and p_company_code is not null and lower(company_code) = lower(trim(p_company_code))),
      current_employee_company_id(),
      (select id from companies where active = true order by created_at asc limit 1)
    )
  limit 1;
$function$;
