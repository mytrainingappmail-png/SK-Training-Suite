-- Rollback for 20261001150000_commercial_layer.sql
do $$ declare t text; begin
  foreach t in array array['companies','company_licenses','employee_roles','employees','discount_codes','razorpay_payments'] loop
    execute format('drop trigger if exists trg_audit_row_change on %I', t);
  end loop; end $$;
drop trigger if exists trg_enforce_employee_limit on employees;
drop trigger if exists trg_enforce_course_limit on courses;
drop trigger if exists trg_enforce_certificate_limit on certificates;
drop trigger if exists trg_enforce_certificate_limit on exam_certificates;
drop trigger if exists trg_enforce_certificate_limit on quiz_certificates;
drop function if exists enforce_employee_limit(), enforce_course_limit(), enforce_certificate_limit(),
  company_certificates_this_month(uuid), company_plan_limits(uuid), audit_row_change(), audit_events_immutable(),
  redeem_discount_code(uuid, uuid, uuid), offboard_company(uuid), reinstate_company(uuid), export_company_data(uuid);
drop table if exists notification_outbox, discount_redemptions;
-- audit_events is intentionally kept (append-only history); drop manually if truly required:
--   alter table audit_events disable trigger trg_audit_events_immutable; drop table audit_events;
drop policy if exists discount_codes_read on discount_codes;
create policy discount_codes_read on discount_codes for select using (auth.uid() is not null);
-- companies.offboarded_at column left in place.
