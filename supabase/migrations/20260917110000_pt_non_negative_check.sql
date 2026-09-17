-- The client's NumField only used HTML's min=0 as a hint (didn't actually
-- block typing "-5", and `|| 0` in its onChange doesn't catch a negative
-- number either since it's truthy) — a typo'd minus sign could silently
-- corrupt a day's Score/Achievement % with no server-side floor. Fixed
-- client-side too (ptUi.tsx's NumField), but the real guarantee has to be
-- here, since nothing stops a direct API call either.
alter table pt_commitments drop constraint if exists chk_pt_commitments_non_negative;
alter table pt_commitments add constraint chk_pt_commitments_non_negative check (
  f2f_planned >= 0 and sv_planned >= 0 and revisit_planned >= 0 and
  calls_planned >= 0 and conn_target >= 0 and talk_target >= 0
);

alter table pt_reports drop constraint if exists chk_pt_reports_non_negative;
alter table pt_reports add constraint chk_pt_reports_non_negative check (
  f2f_done >= 0 and sv_done >= 0 and revisit_done >= 0 and calls_done >= 0 and
  conn_done >= 0 and talk_done >= 0 and leads >= 0 and meetings_fixed >= 0 and bookings >= 0
);
