-- Undo 20261002120000_richer_company_export.sql: put back the smaller export from
-- 20261001150000_commercial_layer.sql (re-run the export_company_data block of that migration).
select 'see supabase/migrations/20261001150000_commercial_layer.sql, section 5, export_company_data' as how_to_restore;
