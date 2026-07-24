-- The previous assessments_company_scoped policy checked
-- `assessment_company_id(id) = current_employee_company_id()`, which
-- re-queries the assessments table itself by id. During INSERT, that
-- self-lookup found no row (the new row isn't reliably visible to a
-- fresh table scan from inside the WITH CHECK evaluation the way a
-- lesson->module->course join on a DIFFERENT table is), so every insert
-- was rejected with 42501 regardless of lesson_id/company_id being
-- correct. Rewriting the check to reference the NEW row's own
-- lesson_id/company_id columns directly (via lesson_company_id(), which
-- looks up a different table) avoids the self-reference entirely.

drop policy if exists assessments_company_scoped on assessments;

create policy assessments_company_scoped on assessments
  for all
  using (
    (lesson_id is not null and lesson_company_id(lesson_id) = current_employee_company_id())
    or (lesson_id is null and company_id = current_employee_company_id())
  )
  with check (
    (lesson_id is not null and lesson_company_id(lesson_id) = current_employee_company_id())
    or (lesson_id is null and company_id = current_employee_company_id())
  );
