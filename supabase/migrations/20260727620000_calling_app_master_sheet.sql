-- Calling App Phase 2, part 1: Master Sheet distribution.
--
-- A "master sheet" isn't a new table — it's simply contacts uploaded
-- with no assignee yet (calling_app_contacts.assigned_to is null),
-- which the existing CSV upload already produces by default. What's
-- new here is tracking WHO distributed a contact and WHEN (so "kisko
-- kitna data diya hai aur kaha tak" — how much has each employee been
-- given, and up to where — can actually be reported), and duplicate
-- detection by mobile number so the same lead is never silently handed
-- to two people.
--
-- No row-count limit anywhere in this design — CSV parsing and bulk
-- insert are already unbounded (Phase 1 never capped them either).

alter table calling_app_contacts add column if not exists assigned_by uuid references calling_app_admins(id) on delete set null;
alter table calling_app_contacts add column if not exists assigned_at timestamptz;

create index if not exists idx_calling_app_contacts_mobile on calling_app_contacts(company_id, mobile_no);
create index if not exists idx_calling_app_contacts_unassigned on calling_app_contacts(company_id, list_id) where assigned_to is null;
