-- Rollback: removes the Induction Day <-> Course Module copy links and their functions. The copies themselves (the Days and Modules that were
-- made) stay exactly as they are - only the memory of "which one is the copy of which" goes.
drop function if exists public.sync_course_day_copies_auto(uuid);
drop function if exists public.day_module_stale();
drop function if exists public.sync_day_module_copies_auto(text, uuid);
drop function if exists public.set_day_module_auto(uuid, text, boolean);
drop function if exists public.get_day_module_links(text, uuid);
drop function if exists public.sync_day_module_copy(text, uuid, uuid);
drop function if exists public.copy_module_to_induction_day(uuid);
drop function if exists public.copy_day_to_course_module(uuid, uuid);
drop function if exists public._dmc_capture_new(uuid, boolean, uuid[]);
drop function if exists public._dmc_fp_module(uuid);
drop function if exists public._dmc_fp_day(uuid);
drop table if exists public.day_module_map;
drop table if exists public.day_module_links;
