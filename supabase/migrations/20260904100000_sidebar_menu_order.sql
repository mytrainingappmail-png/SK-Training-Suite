-- Admin-controlled display order for the employee-facing sidebar. null
-- means "use the built-in order" (Sidebar.tsx falls back to that).
alter table companies add column if not exists sidebar_menu_order text[];
