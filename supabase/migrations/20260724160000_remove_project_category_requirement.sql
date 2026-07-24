-- Category → Project was a two-step admin workflow, but in practice every
-- project ends up with its own one-to-one category (no real grouping
-- value), and admins found the extra "create a category first" step
-- confusing. Making category_id nullable so a Project can be created
-- directly, no category required. Existing categorized projects keep
-- their category link (nothing is lost), the UI just stops requiring or
-- showing it going forward.

alter table real_estate_projects alter column category_id drop not null;
