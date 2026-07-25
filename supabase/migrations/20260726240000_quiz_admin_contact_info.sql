-- Contact info for the "Forgot password?" flow — the quiz_admin's real
-- Supabase Auth email is the synthetic internal one
-- (quiz.{code}.{username}@internal.sktraining), which isn't a real
-- deliverable inbox, so a separate real email/mobile is needed to send
-- a password-reset link to. Both nullable — existing accounts (like the
-- SKE001 "quizadmin" test account) predate this and can add theirs later.
alter table quiz_admins add column if not exists contact_email text;
alter table quiz_admins add column if not exists contact_mobile text;

-- A quiz_admin can already read/update their own row via
-- quiz_admins_company_scoped (company_id = current_quiz_admin_company_id()),
-- so no new RLS policy is needed for them to set their own contact info.
