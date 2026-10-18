-- Switch the feature off for everything, then drop the new pieces. The patched functions keep working without the columns
-- only if re-created from migrations 20261018100000 / 20261001140000 / 20261001220000 (quiz_effective_position is referenced by them).
update quiz_sessions set allow_early_next = false;
update quiz_participants set my_index = null, my_q_started_at = null;
