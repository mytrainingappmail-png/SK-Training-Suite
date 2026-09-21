// Platform-operator-only: pushes a COPY of one of the operator's own
// courses/videos/real-estate-projects into another company's own data.
// Once pushed, the copy is that company's own row (new id, their
// company_id) -- they can edit or delete it freely, and nothing about it
// ever writes back to the operator's original.
//
// Every cloned row's id is generated client-side (crypto.randomUUID())
// instead of relying on INSERT...RETURNING -- the operator only has
// INSERT access into another company's tables (see
// 20260906151000_content_distribution_insert_only.sql), not SELECT, so
// there's nothing to read back. Parent ids are known upfront and simply
// reused when inserting their children.
//
// Deliberately simple for v1: a one-time copy, not a live/synced link.
// Editing the operator's original later does NOT update copies already
// pushed -- push again to send an update. Category/subject links aren't
// carried over (the target company's categories are different rows), and
// a "quiz"-type lesson's actual quiz questions aren't cloned (assessments
// are their own larger structure) -- the lesson itself copies, the target
// admin re-attaches a quiz to it if needed.

import { supabase } from "../../lib/supabase";

async function cloneCourse(courseId: string, targetCompanyId: string, targetCompanyCode: string): Promise<void> {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();
  if (courseError) throw new Error(courseError.message);

  const { data: modules, error: modulesError } = await supabase
    .from("modules")
    .select("*")
    .eq("course_id", courseId)
    .order("module_order", { ascending: true });
  if (modulesError) throw new Error(modulesError.message);

  const newCourseId = crypto.randomUUID();
  const { id: _courseId, created_at: _c1, updated_at: _u1, company_id: _cid, category_id: _cat, created_by: _by, course_code: sourceCode, ...courseRest } = course;
  // course_code is unique PLATFORM-WIDE (not per company), so the source
  // code would collide with itself once copied elsewhere -- prefix with
  // the target company's own code to guarantee uniqueness.
  const clonedCourseCode = `${targetCompanyCode}-${sourceCode}`;
  const { error: insertCourseError } = await supabase
    .from("courses")
    .insert({ ...courseRest, id: newCourseId, company_id: targetCompanyId, category_id: null, created_by: null, course_code: clonedCourseCode });
  if (insertCourseError) throw new Error(insertCourseError.message);

  for (const module of modules ?? []) {
    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("*")
      .eq("module_id", module.id)
      .order("display_order", { ascending: true });
    if (lessonsError) throw new Error(lessonsError.message);

    const newModuleId = crypto.randomUUID();
    const { id: _moduleId, created_at: _mc, updated_at: _mu, course_id: _mCourseId, ...moduleRest } = module;
    const { error: insertModuleError } = await supabase
      .from("modules")
      .insert({ ...moduleRest, id: newModuleId, course_id: newCourseId });
    if (insertModuleError) throw new Error(insertModuleError.message);

    for (const lesson of lessons ?? []) {
      const { id: _lessonId, created_at: _lc, module_id: _lModuleId, ...lessonRest } = lesson;
      const { error: insertLessonError } = await supabase
        .from("lessons")
        .insert({ ...lessonRest, id: crypto.randomUUID(), module_id: newModuleId });
      if (insertLessonError) throw new Error(insertLessonError.message);
    }
  }
}

// library_videos.subject_id is NOT NULL, so (unlike course/project
// categories) a cloned video needs a real target-company subject row --
// created on the fly, named after the source subject, and reused for any
// other videos in the same push that share it (via subjectCache).
async function ensureTargetSubject(
  subjectCache: Map<string, string>,
  sourceSubjectId: string,
  targetCompanyId: string
): Promise<string> {
  if (subjectCache.has(sourceSubjectId)) return subjectCache.get(sourceSubjectId)!;

  const { data: sourceSubject, error: subjectError } = await supabase
    .from("video_subjects")
    .select("subject_name")
    .eq("id", sourceSubjectId)
    .single();
  if (subjectError) throw new Error(subjectError.message);

  const newSubjectId = crypto.randomUUID();
  const { error: insertError } = await supabase
    .from("video_subjects")
    .insert({ id: newSubjectId, company_id: targetCompanyId, subject_name: sourceSubject.subject_name, display_order: 0, active: true });
  if (insertError) throw new Error(insertError.message);

  subjectCache.set(sourceSubjectId, newSubjectId);
  return newSubjectId;
}

async function cloneVideo(videoId: string, targetCompanyId: string, subjectCache: Map<string, string>): Promise<void> {
  const { data: video, error } = await supabase
    .from("library_videos")
    .select("*")
    .eq("id", videoId)
    .single();
  if (error) throw new Error(error.message);

  const targetSubjectId = await ensureTargetSubject(subjectCache, video.subject_id, targetCompanyId);

  const { id: _id, created_at: _c, updated_at: _u, company_id: _cid, subject_id: _sid, ...rest } = video;
  const { error: insertError } = await supabase
    .from("library_videos")
    .insert({ ...rest, id: crypto.randomUUID(), company_id: targetCompanyId, subject_id: targetSubjectId });
  if (insertError) throw new Error(insertError.message);
}

async function cloneRealEstateProject(projectId: string, targetCompanyId: string): Promise<void> {
  const { data: project, error: projectError } = await supabase
    .from("real_estate_projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (projectError) throw new Error(projectError.message);

  const { data: sections, error: sectionsError } = await supabase
    .from("real_estate_project_sections")
    .select("*")
    .eq("project_id", projectId)
    .order("display_order", { ascending: true });
  if (sectionsError) throw new Error(sectionsError.message);

  const { data: brochures, error: brochuresError } = await supabase
    .from("real_estate_project_brochures")
    .select("*")
    .eq("project_id", projectId);
  if (brochuresError) throw new Error(brochuresError.message);

  const newProjectId = crypto.randomUUID();
  const { id: _pid, created_at: _pc, updated_at: _pu, company_id: _pcid, category_id: _pcat, ...projectRest } = project;
  const { error: insertProjectError } = await supabase
    .from("real_estate_projects")
    .insert({ ...projectRest, id: newProjectId, company_id: targetCompanyId, category_id: null });
  if (insertProjectError) throw new Error(insertProjectError.message);

  for (const section of sections ?? []) {
    const { id: _sid, created_at: _sc, updated_at: _su, company_id: _scid, project_id: _sprojId, assessment_id: _said, ...sectionRest } = section;
    const { error: insertSectionError } = await supabase
      .from("real_estate_project_sections")
      .insert({ ...sectionRest, id: crypto.randomUUID(), company_id: targetCompanyId, project_id: newProjectId, assessment_id: null });
    if (insertSectionError) throw new Error(insertSectionError.message);
  }

  for (const brochure of brochures ?? []) {
    const { id: _bid, created_at: _bc, project_id: _bprojId, ...brochureRest } = brochure;
    const { error: insertBrochureError } = await supabase
      .from("real_estate_project_brochures")
      .insert({ ...brochureRest, id: crypto.randomUUID(), project_id: newProjectId });
    if (insertBrochureError) throw new Error(insertBrochureError.message);
  }
}

// An Induction Day copies with all its Page / FAQ sections. A Test section's linked Assessment belongs to
// the source company, so the copy keeps the section but the target admin re-attaches an Assessment.
async function cloneInductionDay(dayId: string, targetCompanyId: string): Promise<void> {
  const { data: day, error: dayError } = await supabase.from("induction_days").select("*").eq("id", dayId).single();
  if (dayError) throw new Error(dayError.message);

  const { data: sections, error: sectionsError } = await supabase
    .from("induction_day_sections")
    .select("*")
    .eq("day_id", dayId)
    .order("display_order", { ascending: true });
  if (sectionsError) throw new Error(sectionsError.message);

  const newDayId = crypto.randomUUID();
  const { id: _id, created_at: _c, updated_at: _u, company_id: _cid, branch_id: _bid, source_id: _sid, ...dayRest } = day;
  const { error: insertDayError } = await supabase
    .from("induction_days")
    .insert({ ...dayRest, id: newDayId, company_id: targetCompanyId, branch_id: null, source_id: null });
  if (insertDayError) throw new Error(insertDayError.message);

  for (const section of sections ?? []) {
    const { id: _sId, created_at: _sc, updated_at: _su, company_id: _scid, day_id: _sday, assessment_id: _said, ...sectionRest } = section;
    const { error: insertSectionError } = await supabase
      .from("induction_day_sections")
      .insert({ ...sectionRest, id: crypto.randomUUID(), company_id: targetCompanyId, day_id: newDayId, assessment_id: null });
    if (insertSectionError) throw new Error(insertSectionError.message);
  }
}

export interface PushSelection {
  courseIds: string[];
  videoIds: string[];
  projectIds: string[];
  inductionDayIds?: string[];
}

export interface PushResult {
  courses: number;
  videos: number;
  projects: number;
  inductionDays: number;
}

export async function pushContentToCompany(
  targetCompanyId: string,
  targetCompanyCode: string,
  selection: PushSelection
): Promise<PushResult> {
  for (const courseId of selection.courseIds) {
    await cloneCourse(courseId, targetCompanyId, targetCompanyCode);
  }
  const subjectCache = new Map<string, string>();
  for (const videoId of selection.videoIds) {
    await cloneVideo(videoId, targetCompanyId, subjectCache);
  }
  for (const projectId of selection.projectIds) {
    await cloneRealEstateProject(projectId, targetCompanyId);
  }
  for (const dayId of selection.inductionDayIds ?? []) {
    await cloneInductionDay(dayId, targetCompanyId);
  }
  return {
    courses: selection.courseIds.length,
    videos: selection.videoIds.length,
    projects: selection.projectIds.length,
    inductionDays: selection.inductionDayIds?.length ?? 0,
  };
}
