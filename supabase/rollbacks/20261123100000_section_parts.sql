-- Undo 20261123100000_section_parts.sql (the extra parts' text is lost; the sections' main text stays).
alter table public.real_estate_project_sections drop column if exists parts;
alter table public.lessons drop column if exists parts;
