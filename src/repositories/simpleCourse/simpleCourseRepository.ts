// Data access for the simple "My Courses" screen. It deliberately talks to the same tables the
// older Course screens use (courses, modules, lessons, learning_resources, course_visibility),
// so a course made here shows up everywhere else, and the other way round — no second copy of
// anything, no migration.

import { supabase } from "../../lib/supabase";

export type SimpleLessonType = "video" | "text" | "document";

export interface SimpleResource {
  id: string;
  lesson_id: string;
  resource_title: string;
  resource_type: string;
  file_url: string;
}

export interface SimpleLesson {
  id: string;
  module_id: string;
  lesson_title: string;
  lesson_type: string;
  content: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  display_order: number | null;
  resources: SimpleResource[];
}

export interface SimpleModule {
  id: string;
  course_id: string;
  module_name: string;
  module_order: number | null;
  lessons: SimpleLesson[];
}

export interface SimpleCourse {
  id: string;
  course_code: string;
  course_name: string;
  short_description: string | null;
  thumbnail: string | null;
  active: boolean;
  created_at: string;
  chapters: number;
  lessons: number;
}

function fail(label: string, error: { message: string }): never {
  console.error(`[simpleCourseRepository] ${label}:`, error);
  throw new Error(error.message);
}

function randomCode(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** Courses of ONE company, with chapter and lesson counts. */
export async function listCourses(companyId: string): Promise<SimpleCourse[]> {
  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, course_code, course_name, short_description, thumbnail, active, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) fail("listCourses", error);
  const rows = courses ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((c) => c.id);
  const { data: modules, error: mError } = await supabase.from("modules").select("id, course_id").in("course_id", ids);
  if (mError) fail("listCourses (modules)", mError);
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons, error: lError } = moduleIds.length
    ? await supabase.from("lessons").select("id, module_id").in("module_id", moduleIds)
    : { data: [] as { id: string; module_id: string }[], error: null };
  if (lError) fail("listCourses (lessons)", lError);

  const courseOfModule = new Map((modules ?? []).map((m) => [m.id, m.course_id as string]));
  return rows.map((c) => ({
    ...c,
    chapters: (modules ?? []).filter((m) => m.course_id === c.id).length,
    lessons: (lessons ?? []).filter((l) => courseOfModule.get(l.module_id) === c.id).length,
  })) as SimpleCourse[];
}

/** Creates a course as a DRAFT with sensible defaults (the customer is never asked for a code, level, category…). */
export async function createCourse(companyId: string, name: string, description: string, protection: object = {}): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase
      .from("courses")
      .insert({
        company_id: companyId,
        course_code: randomCode("CRS"),
        course_name: name.trim(),
        short_description: description.trim(),
        full_description: "",
        thumbnail: "",
        level: "beginner",
        duration_days: 0,
        duration_hours: 0,
        passing_percentage: 50,
        certificate_enabled: false,
        active: false,
        ...protection,
      })
      .select("id")
      .single();
    if (!error && data) {
      await addModule(data.id, "Chapter 1", 1);
      return data.id as string;
    }
    // course codes are unique across the whole platform: a clash is retried with a new random code
    if (error && error.code !== "23505") fail("createCourse", error);
  }
  throw new Error("Could not create the course. Please try again.");
}

export async function updateCourse(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("courses").update(patch).eq("id", id);
  if (error) fail("updateCourse", error);
}

export interface CourseProtection {
  watermark_enabled: boolean;
  watermark_text: string | null;
  watermark_orientation: "horizontal" | "vertical" | "diagonal";
  watermark_opacity: number;
  no_copy: boolean;
}

export async function getCourse(id: string): Promise<{ id: string; course_name: string; short_description: string | null; active: boolean } & CourseProtection> {
  const { data, error } = await supabase
    .from("courses")
    .select("id, course_name, short_description, active, watermark_enabled, watermark_text, watermark_orientation, watermark_opacity, no_copy")
    .eq("id", id)
    .single();
  if (error) fail("getCourse", error);
  return data as { id: string; course_name: string; short_description: string | null; active: boolean } & CourseProtection;
}

export async function enrolledCount(courseId: string): Promise<number> {
  const { count, error } = await supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", courseId);
  if (error) return 0;
  return count ?? 0;
}

export async function deleteCourse(id: string): Promise<void> {
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) fail("deleteCourse", error);
}

/** Chapters with their lessons (and any attached file) in order. */
export async function getOutline(courseId: string): Promise<SimpleModule[]> {
  const { data: modules, error } = await supabase
    .from("modules")
    .select("id, course_id, module_name, module_order")
    .eq("course_id", courseId)
    .order("module_order", { ascending: true });
  if (error) fail("getOutline (modules)", error);
  const mods = modules ?? [];
  if (mods.length === 0) return [];

  const { data: lessons, error: lError } = await supabase
    .from("lessons")
    .select("id, module_id, lesson_title, lesson_type, content, video_url, duration_minutes, display_order")
    .in("module_id", mods.map((m) => m.id))
    .order("display_order", { ascending: true });
  if (lError) fail("getOutline (lessons)", lError);

  const lessonIds = (lessons ?? []).map((l) => l.id);
  const { data: resources, error: rError } = lessonIds.length
    ? await supabase.from("learning_resources").select("id, lesson_id, resource_title, resource_type, file_url").in("lesson_id", lessonIds)
    : { data: [] as SimpleResource[], error: null };
  if (rError) fail("getOutline (files)", rError);

  return mods.map((m) => ({
    ...m,
    lessons: (lessons ?? [])
      .filter((l) => l.module_id === m.id)
      .map((l) => ({ ...l, resources: ((resources ?? []) as SimpleResource[]).filter((r) => r.lesson_id === l.id) })),
  })) as SimpleModule[];
}

export async function addModule(courseId: string, name: string, order: number): Promise<void> {
  const { error } = await supabase.from("modules").insert({
    course_id: courseId,
    module_code: randomCode("MOD"),
    module_name: name.trim() || "New chapter",
    description: "",
    module_order: order,
    estimated_minutes: 1,
    thumbnail: "",
    active: true,
  });
  if (error) fail("addModule", error);
}

export async function updateModule(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("modules").update(patch).eq("id", id);
  if (error) fail("updateModule", error);
}

export async function deleteModule(id: string): Promise<void> {
  const { error } = await supabase.from("modules").delete().eq("id", id);
  if (error) fail("deleteModule", error);
}

export async function addLesson(moduleId: string, type: SimpleLessonType, title: string, order: number): Promise<string> {
  const { data, error } = await supabase
    .from("lessons")
    .insert({
      module_id: moduleId,
      lesson_title: title.trim() || "New lesson",
      lesson_type: type,
      content: "",
      video_url: "",
      thumbnail: "",
      duration_minutes: 5,
      display_order: order,
      downloadable: false,
      active: true,
    })
    .select("id")
    .single();
  if (error) fail("addLesson", error);
  return (data as { id: string }).id;
}

export async function updateLesson(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("lessons").update(patch).eq("id", id);
  if (error) fail("updateLesson", error);
}

export async function deleteLesson(id: string): Promise<void> {
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) fail("deleteLesson", error);
}

/** A "File" lesson has exactly one downloadable file. */
export async function setLessonFile(lessonId: string, fileUrl: string, title: string, resourceType: string): Promise<void> {
  const { error: delError } = await supabase.from("learning_resources").delete().eq("lesson_id", lessonId);
  if (delError) fail("setLessonFile (clear)", delError);
  const { error } = await supabase.from("learning_resources").insert({
    lesson_id: lessonId,
    resource_title: title,
    resource_type: resourceType,
    file_url: fileUrl,
    description: "",
    display_order: 1,
    downloadable: true,
    active: true,
  });
  if (error) fail("setLessonFile", error);
}

// ── Who takes the course ─────────────────────────────────────────────────────
// A published course only shows up for an employee once they are enrolled in it
// (that is how the learner screens find their courses), so "give the course" = enrol.

export interface AssignableEmployee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string | null;
  branch_id: string | null;
}

export interface CourseAssignment {
  employee_id: string;
  status: string;
}

export async function listEmployees(companyId: string): Promise<AssignableEmployee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, employee_code, first_name, last_name, branch_id")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("first_name", { ascending: true });
  if (error) fail("listEmployees", error);
  return (data ?? []) as AssignableEmployee[];
}

export async function getAssignments(courseId: string): Promise<CourseAssignment[]> {
  const { data, error } = await supabase.from("enrollments").select("employee_id, status").eq("course_id", courseId).eq("enrollment_type", "COURSE");
  if (error) fail("getAssignments", error);
  return (data ?? []) as CourseAssignment[];
}

/** Enrols the given employees; anyone already enrolled is skipped. Returns how many were newly added. */
export async function assignEmployees(companyId: string, courseId: string, employees: AssignableEmployee[]): Promise<number> {
  const existing = new Set((await getAssignments(courseId)).map((a) => a.employee_id));
  const fresh = employees.filter((e) => !existing.has(e.id));
  if (fresh.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("enrollments").insert(
    fresh.map((e) => ({
      company_id: companyId,
      branch_id: e.branch_id,
      employee_id: e.id,
      course_id: courseId,
      assignment_type: "MANUAL",
      enrollment_type: "COURSE",
      status: "PENDING",
      start_date: today,
    })),
  );
  if (error) fail("assignEmployees", error);
  return fresh.length;
}

/** Takes the course away from someone who has not started it (progress is never deleted here). */
export async function unassignEmployee(courseId: string, employeeId: string): Promise<void> {
  const { error } = await supabase.from("enrollments").delete().eq("course_id", courseId).eq("employee_id", employeeId).eq("status", "PENDING");
  if (error) fail("unassignEmployee", error);
}
