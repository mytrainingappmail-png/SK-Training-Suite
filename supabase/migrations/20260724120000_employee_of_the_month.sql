-- Employee of the Month — admin picks the winner (informed by the
-- existing Reports page: attendance %, average assessment score, etc.
-- already computed there), uploads their photo, and writes a
-- congratulatory message. Deliberately admin-selected rather than a
-- black-box auto-computed score, so the recognition feels fair and the
-- admin can weigh discipline + performance + anything else that matters.
-- One winner per company per month/year.

create table if not exists employee_of_the_month (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  month int not null check (month between 1 and 12),
  year int not null check (year between 2000 and 2100),
  photo_url text not null default '',
  message text not null default '',
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, year, month)
);

create index if not exists idx_employee_of_the_month_company on employee_of_the_month (company_id, year desc, month desc);

alter table employee_of_the_month enable row level security;
create policy employee_of_the_month_company_scoped on employee_of_the_month
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());
