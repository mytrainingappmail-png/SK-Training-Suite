-- Remembers which master item (course / video / project / induction day) the platform owner
-- has already sent to which company, so the Content Distribution screen can show it and
-- avoid sending the same thing twice (which used to create a duplicate in that company).
-- Owner only.

create table if not exists content_distribution_log (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null check (kind in ('course', 'video', 'project', 'induction_day')),
  source_id         uuid not null,
  target_company_id uuid not null references companies(id) on delete cascade,
  pushed_at         timestamptz not null default now(),
  pushed_by         uuid default auth.uid()
);
create index if not exists idx_content_distribution_log_source on content_distribution_log (kind, source_id);
create index if not exists idx_content_distribution_log_target on content_distribution_log (target_company_id);

alter table content_distribution_log enable row level security;
revoke all on content_distribution_log from anon;
drop policy if exists content_distribution_log_owner on content_distribution_log;
create policy content_distribution_log_owner on content_distribution_log for all to authenticated
  using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
