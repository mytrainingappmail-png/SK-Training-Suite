-- Adds manual drag-and-drop ordering to courses, and a safe, atomic way for
-- an admin to convert an entire course into a single module of another
-- course (used by the new "Convert to Module" action in Course Management).

-- ── 1. Course ordering ──────────────────────────────────────────────────────

ALTER TABLE courses ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

-- Backfill existing rows with a stable order, scoped per category (mirrors
-- how modules are ordered per course, lessons per module).
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY course_name) AS rn
  FROM courses
)
UPDATE courses SET display_order = ordered.rn
FROM ordered
WHERE courses.id = ordered.id AND courses.display_order = 0;

-- ── 2. Convert-course-to-module RPC ─────────────────────────────────────────
-- Moves every lesson from every module of p_source_course_id into one new
-- module created inside p_target_course_id, then deletes the source course
-- and its now-empty modules. SECURITY DEFINER + a single function body means
-- this all happens in one transaction: it either fully succeeds or fully
-- rolls back, so a mid-operation failure can never leave lessons orphaned or
-- a course half-deleted.

CREATE OR REPLACE FUNCTION convert_course_to_module(
  p_source_course_id uuid,
  p_target_course_id uuid,
  p_module_name text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course courses%ROWTYPE;
  v_target_company_id uuid;
  v_caller_company_id uuid;
  v_new_module_id uuid;
  v_next_module_order int;
BEGIN
  IF p_source_course_id = p_target_course_id THEN
    RAISE EXCEPTION 'Source and target course cannot be the same.';
  END IF;

  -- Same company-scoping boundary as every other write in this schema
  -- (see current_employee_company_id() / RLS policies) — this function runs
  -- as SECURITY DEFINER and therefore bypasses RLS, so it must re-enforce
  -- that boundary itself instead of relying on table policies.
  v_caller_company_id := current_employee_company_id();
  IF v_caller_company_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_course FROM courses WHERE id = p_source_course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source course not found.';
  END IF;

  SELECT company_id INTO v_target_company_id FROM courses WHERE id = p_target_course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target course not found.';
  END IF;

  IF v_target_company_id IS DISTINCT FROM v_course.company_id THEN
    RAISE EXCEPTION 'Source and target course must belong to the same company.';
  END IF;

  IF v_course.company_id IS DISTINCT FROM v_caller_company_id THEN
    RAISE EXCEPTION 'Not authorized for this company.';
  END IF;

  SELECT COALESCE(MAX(module_order), 0) + 1 INTO v_next_module_order
  FROM modules WHERE course_id = p_target_course_id;

  INSERT INTO modules (course_id, module_code, module_name, description, module_order, estimated_minutes, thumbnail, active)
  VALUES (
    p_target_course_id,
    v_course.course_code,
    COALESCE(NULLIF(TRIM(p_module_name), ''), v_course.course_name),
    v_course.short_description,
    v_next_module_order,
    GREATEST(v_course.duration_days * 24 * 60 + v_course.duration_hours * 60, 1),
    v_course.thumbnail,
    true
  )
  RETURNING id INTO v_new_module_id;

  -- Re-parent every lesson from every module of the source course, preserving
  -- the order lessons already had (by module, then by lesson, within it).
  WITH ordered_lessons AS (
    SELECT l.id, ROW_NUMBER() OVER (ORDER BY m.module_order, l.display_order) AS rn
    FROM lessons l
    JOIN modules m ON m.id = l.module_id
    WHERE m.course_id = p_source_course_id
  )
  UPDATE lessons SET module_id = v_new_module_id, display_order = ordered_lessons.rn
  FROM ordered_lessons
  WHERE lessons.id = ordered_lessons.id;

  DELETE FROM modules WHERE course_id = p_source_course_id;
  DELETE FROM courses WHERE id = p_source_course_id;

  RETURN v_new_module_id;
END;
$$;

GRANT EXECUTE ON FUNCTION convert_course_to_module(uuid, uuid, text) TO authenticated;
