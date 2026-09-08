-- A second homepage ticker, same pattern as platform_marketing_updates,
-- for real (sourced, linked) real estate industry news -- the pitch being
-- "here's why training isn't optional anymore" (RERA mandates, skill gap
-- reports, etc.). source_name/source_url so every item can link back to
-- where it actually came from, since this is real news, not the
-- operator's own copy.
create table platform_marketing_industry_news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  source_name text,
  source_url text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table platform_marketing_industry_news enable row level security;

create policy platform_marketing_industry_news_read on platform_marketing_industry_news
  for select using (true);
create policy platform_marketing_industry_news_write_operator on platform_marketing_industry_news
  for all using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
