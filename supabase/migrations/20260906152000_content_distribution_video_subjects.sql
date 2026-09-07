-- library_videos.subject_id turned out to be NOT NULL, so a cloned video
-- needs a real subject row in the target company (can't just null it out
-- like courses/real-estate categories, which are nullable). The service
-- layer creates one on the fly per push (named after the source subject),
-- reusing it for any other videos in the same push that share a subject
-- -- this policy is what lets that insert land in another company.
create policy video_subjects_platform_operator_insert
  on video_subjects for insert
  to authenticated
  with check (current_company_is_platform_operator());
