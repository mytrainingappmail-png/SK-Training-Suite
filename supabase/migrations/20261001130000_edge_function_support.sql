-- Support tables for hardened edge functions (Phase 4).
--
-- edge_rate_limits / edge_rate_limit(): a simple fixed-window counter the edge
--   functions use to throttle email sending, password-reset codes and public
--   sign-ups. Only the service role can touch it.
-- razorpay_payments: one row per captured Razorpay payment so a webhook that
--   Razorpay retries can never renew a licence twice.
-- calling_app_admins: writing rows (which grants Calling App access, incl.
--   is_admin) was open to ANY employee of the company; now company admins only.

create table if not exists edge_rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  hits         integer not null default 0
);
alter table edge_rate_limits enable row level security;
revoke all on edge_rate_limits from anon, authenticated;

create or replace function edge_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into edge_rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;

  -- housekeeping, ~1% of calls
  if random() < 0.01 then
    delete from edge_rate_limits where window_start < now() - interval '2 days';
  end if;

  return v_hits <= p_max;
end;
$$;
revoke all on function edge_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function edge_rate_limit(text, integer, integer) to service_role;

create table if not exists razorpay_payments (
  payment_id         text primary key,
  order_id           text,
  company_license_id uuid,
  amount_paise       bigint not null,
  currency           text,
  status             text not null default 'processing',   -- processing | renewed | rejected
  note               text,
  created_at         timestamptz not null default now()
);
alter table razorpay_payments enable row level security;
revoke all on razorpay_payments from anon, authenticated;

-- calling_app_admins: only a company administrator may grant/edit access.
drop policy if exists calling_app_admins_write_employee on calling_app_admins;
create policy calling_app_admins_write_employee on calling_app_admins for all to authenticated
  using (company_id = current_employee_company_id() and current_employee_is_company_admin())
  with check (company_id = current_employee_company_id() and current_employee_is_company_admin());
