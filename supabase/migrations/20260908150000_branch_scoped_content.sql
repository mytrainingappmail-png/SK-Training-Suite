-- Branch-scoped content for Real Estate Projects and Induction Days.
--
-- branch_id: nullable. NULL = shared across every branch (the default --
-- everything that already exists stays exactly as visible as before,
-- nothing breaks). Set = visible only to employees in that one branch.
--
-- source_id: nullable, self-referencing. Set only on a row created via
-- "Clone to Branch" -- points back at the generic (branch_id IS NULL) row
-- it was cloned from. The employee-facing query uses this to prefer a
-- branch's own customized clone over the generic version it came from,
-- rather than showing both.
alter table real_estate_projects add column if not exists branch_id uuid references branches(id) on delete set null;
alter table real_estate_projects add column if not exists source_id uuid references real_estate_projects(id) on delete set null;

alter table induction_days add column if not exists branch_id uuid references branches(id) on delete set null;
alter table induction_days add column if not exists source_id uuid references induction_days(id) on delete set null;

create index idx_real_estate_projects_branch on real_estate_projects(branch_id);
create index idx_real_estate_projects_source on real_estate_projects(source_id);
create index idx_induction_days_branch on induction_days(branch_id);
create index idx_induction_days_source on induction_days(source_id);
