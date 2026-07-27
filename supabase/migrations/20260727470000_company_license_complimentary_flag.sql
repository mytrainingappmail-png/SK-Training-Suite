-- Lets a license be marked "complimentary" (free — no payment expected),
-- for cases like an internal/demo company or a goodwill account. This is
-- purely a record-keeping flag for reporting; it has never gated anything
-- functionally since license issuance itself has no payment step today.

alter table company_licenses add column if not exists is_complimentary boolean not null default false;
