-- 1) Induction: the admin decides, day by day, WHEN an employee may open a day.
--
--    next_day        (the existing behaviour, still the default) opens after the previous day was
--                    completed on an EARLIER calendar date, and its test (if any) was passed
--    after_previous  opens as soon as the previous day is completed and its test passed — no
--                    waiting for another date
--    anytime         open from the very start, no conditions at all (e.g. a short "Company Overview")
--
--    Existing days keep 'next_day', so nothing changes for anyone until an admin changes a day.

alter table public.induction_days
  add column if not exists unlock_mode text not null default 'next_day'
  check (unlock_mode in ('next_day', 'after_previous', 'anytime'));

-- 2) Platform owner: companies that automatically receive everything the owner publishes
--    (e.g. the owner's own RMT001, so it can be checked as a real company without pushing by hand).

create table if not exists public.platform_auto_send_targets (
  company_id uuid primary key references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_run_at timestamptz
);

alter table public.platform_auto_send_targets enable row level security;
revoke all on public.platform_auto_send_targets from anon;
drop policy if exists platform_auto_send_targets_owner on public.platform_auto_send_targets;
create policy platform_auto_send_targets_owner on public.platform_auto_send_targets
  for all to authenticated
  using (public.current_company_is_platform_operator())
  with check (public.current_company_is_platform_operator());
