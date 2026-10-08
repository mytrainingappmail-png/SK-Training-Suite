-- Rollback for 20261008100000_marketing_founder_section
alter table platform_marketing_settings drop column if exists founder;
