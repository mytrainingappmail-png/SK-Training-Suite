-- A "What's New" feed for the public marketing homepage -- same pattern
-- as platform_marketing_testimonials (public read, platform-operator-only
-- write). Rendered as a scrolling sidebar ticker on the homepage.
create table platform_marketing_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table platform_marketing_updates enable row level security;

create policy platform_marketing_updates_read on platform_marketing_updates
  for select using (true);
create policy platform_marketing_updates_write_operator on platform_marketing_updates
  for all using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
