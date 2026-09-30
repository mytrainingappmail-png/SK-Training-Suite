-- Rollback for 20261001130000_edge_function_support.sql
drop policy if exists calling_app_admins_write_employee on calling_app_admins;
create policy calling_app_admins_write_employee on calling_app_admins
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());
drop table if exists razorpay_payments;
drop function if exists edge_rate_limit(text, integer, integer);
drop table if exists edge_rate_limits;
