-- can_upload/can_download originally defaulted to TRUE, so every new
-- employee granted Calling App access got bulk upload/export rights by
-- default -- backwards from can_manage_master_sheet, which correctly
-- defaults to FALSE. A regular telecaller should not be able to
-- upload/export the whole company's lead sheet; only an admin or someone
-- explicitly granted the right (team leader/MIS) should.
alter table calling_app_admins alter column can_upload set default false;
alter table calling_app_admins alter column can_download set default false;
