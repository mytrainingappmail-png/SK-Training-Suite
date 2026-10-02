-- Undo 20261002161000_platform_link_existing_copies.sql (links already made are kept in platform_content_map).
drop function if exists public.platform_link_existing_copies(uuid);
drop function if exists public._pcm_link_project(uuid, uuid, uuid), public._pcm_link_day(uuid, uuid, uuid), public._pcm_link_course(uuid, uuid, uuid),
  public._pcm_link_assessment(uuid, uuid, uuid), public._pcm_link(text, uuid, uuid, uuid, uuid);
