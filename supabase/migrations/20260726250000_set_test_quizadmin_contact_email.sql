-- Set a real contact email on the SKE001 "quizadmin" test account so the
-- forgot-password flow can be verified live end-to-end.
update quiz_admins set contact_email = 'inder.positive@gmail.com'
where username = 'quizadmin' and company_id = 'b259bfa8-bf5b-464f-b9a5-008d00efa1e4';
