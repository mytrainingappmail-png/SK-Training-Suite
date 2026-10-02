-- Undo 20261002160000_platform_content_clone_and_sync.sql (copies already made are kept).
drop function if exists public.platform_content_changes();
drop function if exists public.platform_sync_content(text, uuid, uuid);
drop function if exists public.platform_clone_content(text, uuid, uuid);
drop policy if exists induction_section_views_company_read on public.induction_section_views;
drop function if exists public._pcm_fingerprint(text, uuid), public._pcm_fp_assessments(uuid[]), public._pcm_clone_video(uuid, uuid),
  public._pcm_sync_project(uuid, uuid, uuid), public._pcm_clone_project(uuid, uuid), public._pcm_clone_project_section(uuid, uuid, uuid),
  public._pcm_sync_day(uuid, uuid, uuid), public._pcm_clone_day(uuid, uuid), public._pcm_clone_day_section(uuid, uuid, uuid),
  public._pcm_sync_course(uuid, uuid, uuid), public._pcm_sync_lesson(uuid, uuid, uuid), public._pcm_clone_course(uuid, uuid),
  public._pcm_clone_module(uuid, uuid, uuid), public._pcm_clone_lesson(uuid, uuid, uuid),
  public._pcm_sync_assessment(uuid, uuid, uuid), public._pcm_sync_row(regclass, uuid, uuid, text[]), public._pcm_child(text, uuid, uuid),
  public._pcm_next_order(regclass, uuid), public._pcm_exists(regclass, uuid);
drop table if exists public.platform_content_map;
-- platform_clone_assessment: re-run supabase/migrations/20261002110000_platform_clone_assessment.sql to restore the earlier version.
