-- Lets a company admin turn PDF brochure uploads off entirely (Google Drive/any-link stays
-- available either way) — a PDF sits in storage counting against the plan's quota forever; a
-- link costs nothing. Off by default: a brand-new company starts link-only, and an admin who
-- wants uploads back turns it on deliberately in Company Management.
alter table companies add column if not exists brochure_pdf_upload_enabled boolean not null default false;
