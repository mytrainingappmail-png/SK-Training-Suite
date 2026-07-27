-- Admin-configurable placement for the company name shown under the
-- sidebar logo (left-aligned under the logo, or centered under it).
alter table companies
  add column if not exists sidebar_name_position text not null default 'left'
    check (sidebar_name_position in ('left', 'center'));
