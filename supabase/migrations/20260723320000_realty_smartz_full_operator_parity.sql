-- Realty Smartz is being handed over as a full, independent copy of the
-- project (they'll run it as their own enterprise, not as a subscriber
-- under S&K) - so it needs the exact same platform-level admin access as
-- S&K: Settings, Theme, Menu, Permissions, Plans, Discount Codes, and
-- Payment Settings, all of which were correctly restricted to the platform
-- operator only. Marking Realty Smartz as a platform operator too restores
-- full admin parity for them.

update companies set is_platform_operator = true where company_code = 'RSPL001';
