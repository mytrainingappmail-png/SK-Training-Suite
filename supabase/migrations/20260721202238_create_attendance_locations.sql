-- Multi-location attendance geofencing.
--
-- Replaces the one-geofence-per-branch model (branch_geofences) with a
-- general list of named, searchable locations (office, site visit,
-- etc.) per company, plus a per-employee scope: "all" configured
-- locations are acceptable, or "specific" locations only.
--
-- branch_geofences is left in place (unused going forward) so existing
-- data is never lost; its one existing row is copied forward below.

create table if not exists attendance_locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  location_name text not null,
  location_type text not null default 'office' check (location_type in ('office', 'site', 'other')),
  address text not null default '',
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer not null default 200,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists employee_attendance_locations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  location_id uuid not null references attendance_locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (employee_id, location_id)
);

alter table employees
  add column if not exists attendance_location_scope text not null default 'all'
  check (attendance_location_scope in ('all', 'specific'));

-- Carry forward the existing branch_geofences row(s) as "office" locations.
insert into attendance_locations (
  company_id, branch_id, location_name, location_type, address,
  latitude, longitude, radius_meters, active, created_at, updated_at
)
select
  b.company_id, g.branch_id, b.branch_name || ' Office', 'office', coalesce(b.address, ''),
  g.office_latitude, g.office_longitude, g.radius_meters, g.active, g.created_at, g.updated_at
from branch_geofences g
join branches b on b.id = g.branch_id
where not exists (
  select 1 from attendance_locations al where al.branch_id = g.branch_id
);
