-- Mirror of convert_course_to_module: pulls a single module out of its
-- course and turns it into its own new, standalone course. Unlike the
-- course→module conversion, this is non-destructive to the source course —
-- it just re-parents the module (and every lesson under it moves with it,
-- since lessons reference the module, not the course) onto a brand-new
-- course row, leaving the rest of the source course untouched.

CREATE OR REPLACE FUNCTION convert_module_to_course(
  p_module_id uuid,
  p_course_code text,
  p_course_name text,
  p_category_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_module modules%ROWTYPE;
  v_source_course courses%ROWTYPE;
  v_caller_company_id uuid;
  v_target_category_id uuid;
  v_next_display_order int;
  v_new_course_id uuid;
BEGIN
  IF NOT NULLIF(TRIM(p_course_code), '') IS NOT NULL THEN
    RAISE EXCEPTION 'Course code is required.';
  END IF;
  IF NOT NULLIF(TRIM(p_course_name), '') IS NOT NULL THEN
    RAISE EXCEPTION 'Course name is required.';
  END IF;

  v_caller_company_id := current_employee_company_id();
  IF v_caller_company_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_module FROM modules WHERE id = p_module_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Module not found.';
  END IF;

  SELECT * INTO v_source_course FROM courses WHERE id = v_module.course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source course not found.';
  END IF;

  IF v_source_course.company_id IS DISTINCT FROM v_caller_company_id THEN
    RAISE EXCEPTION 'Not authorized for this company.';
  END IF;

  v_target_category_id := COALESCE(p_category_id, v_source_course.category_id);

  SELECT COALESCE(MAX(display_order), 0) + 1 INTO v_next_display_order
  FROM courses WHERE category_id = v_target_category_id;

  INSERT INTO courses (
    company_id, category_id, course_code, course_name, short_description, full_description,
    thumbnail, level, duration_days, duration_hours, passing_percentage,
    certificate_enabled, display_order, active, created_by
  )
  VALUES (
    v_source_course.company_id,
    v_target_category_id,
    TRIM(p_course_code),
    TRIM(p_course_name),
    v_module.description,
    '',
    COALESCE(NULLIF(v_module.thumbnail, ''), v_source_course.thumbnail),
    v_source_course.level,
    0,
    GREATEST(CEIL(v_module.estimated_minutes / 60.0), 1)::int,
    v_source_course.passing_percentage,
    v_source_course.certificate_enabled,
    v_next_display_order,
    true,
    NULL
  )
  RETURNING id INTO v_new_course_id;

  -- Re-parent the module itself onto the new course. Every lesson under it
  -- moves automatically, since lessons reference module_id, not course_id.
  UPDATE modules SET course_id = v_new_course_id, module_order = 1 WHERE id = p_module_id;

  RETURN v_new_course_id;
END;
$$;

GRANT EXECUTE ON FUNCTION convert_module_to_course(uuid, text, text, uuid) TO authenticated;
