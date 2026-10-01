-- One-time cut-over: platform-operator powers move to the PLATFORM owner company only.
-- Existing customer/own companies become ordinary tenants; the owner's own training
-- company gets a complimentary (free, unlimited-style) licence so it keeps working.
update companies set is_platform_operator = false
where company_code <> 'PLATFORM' and is_platform_operator = true;

insert into company_licenses (company_id, plan_id, start_date, end_date, billing_cycle, status, grace_period_days, auto_renew, is_complimentary)
select c.id, (select id from subscription_plans where plan_code = 'enterprise'), current_date, current_date + 3650, 'yearly', 'active', 30, false, true
from companies c
where c.company_code = 'RMT001'
  and not exists (select 1 from company_licenses cl where cl.company_id = c.id);
