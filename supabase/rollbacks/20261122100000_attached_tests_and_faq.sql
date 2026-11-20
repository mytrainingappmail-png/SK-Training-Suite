-- Undo 20261122100000_attached_tests_and_faq.sql (drops only the new columns; the tests themselves stay as ordinary tests).
alter table public.real_estate_project_sections drop column if exists test_required;
alter table public.lessons drop column if exists faq_items, drop column if exists test_required;
