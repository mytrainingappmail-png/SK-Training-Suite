-- Header (product brand, e.g. "RealTrainer") and footer (the operator's actual registered
-- business/company name, e.g. "RealtyMindTech Enterprises") were sharing one pair of fields
-- (footer_company_name/footer_tagline), so setting one always overwrote the other. Split them.

alter table platform_marketing_settings add column if not exists brand_name text not null default 'RealTrainer';
alter table platform_marketing_settings add column if not exists brand_tagline text;

update platform_marketing_settings set brand_tagline = coalesce(brand_tagline, 'Sales training built for real estate teams.');
