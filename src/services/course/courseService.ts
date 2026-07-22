import type { Course } from "../../types/course";
import type { CourseForm } from "../../types/course";

import {
  getAllCourses,
  getCourseById,
  createCourse as repositoryCreateCourse,
  updateCourse,
  deleteCourse,
  setCourseStatus,
  convertCourseToModule as repositoryConvertCourseToModule,
} from "../../repositories/course/courseRepository";

function toCourseForm(course: Course): CourseForm {
  return {
    company_id: course.company_id,
    category_id: course.category_id,
    course_code: course.course_code,
    course_name: course.course_name,
    short_description: course.short_description,
    full_description: course.full_description,
    thumbnail: course.thumbnail,
    level: course.level,
    duration_days: course.duration_days,
    duration_hours: course.duration_hours,
    passing_percentage: course.passing_percentage,
    certificate_enabled: course.certificate_enabled,
    display_order: course.display_order,
    active: course.active,
    created_by: course.created_by,
  };
}

// Reorders courses within the same category — mirrors the modules/lessons
// reorder pattern (each row's full form is re-saved with a new display_order).
export async function reorderCourses(orderedCourses: Course[]): Promise<void> {
  await Promise.all(
    orderedCourses.map((c, i) =>
      updateCourse(c.id, { ...toCourseForm(c), display_order: i + 1 })
    )
  );
}

// Merges an entire course into another course as a single new module —
// every lesson from every module of the source course is re-parented under
// the new module (in order), then the source course and its now-empty
// modules are deleted. Runs as one atomic DB transaction (see the
// convert_course_to_module SQL function) so it can't leave lessons
// orphaned or half-moved if something fails partway through.
export async function convertCourseToModule(
  sourceCourseId: string,
  targetCourseId: string,
  moduleName?: string
): Promise<string> {
  if (!sourceCourseId || !targetCourseId) {
    throw new Error("Both a source and target course are required.");
  }
  if (sourceCourseId === targetCourseId) {
    throw new Error("Source and target course cannot be the same.");
  }
  return await repositoryConvertCourseToModule(sourceCourseId, targetCourseId, moduleName);
}

export async function loadCourses(): Promise<Course[]> {
  return await getAllCourses();
}

export async function loadCourse(id: string): Promise<Course> {
  if (!id) {
    throw new Error("Invalid Course ID.");
  }

  return await getCourseById(id);
}

export async function createCourse(data: CourseForm): Promise<Course> {
  validateCourseForm(data);

  return await repositoryCreateCourse(data);
}

export async function saveCourse(
  id: string,
  data: Partial<CourseForm>
): Promise<Course> {
  if (!id) {
    throw new Error("Invalid Course ID.");
  }

  validateCourseForm(data);

  return await updateCourse(id, data);
}

export async function removeCourse(id: string): Promise<void> {
  if (!id) {
    throw new Error("Invalid Course ID.");
  }

  await deleteCourse(id);
}

export async function toggleCourseStatus(
  id: string,
  active: boolean
): Promise<Course> {
  if (!id) {
    throw new Error("Invalid Course ID.");
  }

  return await setCourseStatus(id, active);
}

function validateCourseForm(data: Partial<CourseForm>): void {
  if (!data.company_id) {
    throw new Error("Company is required.");
  }

  if (!data.category_id) {
    throw new Error("Category is required.");
  }

  if (!data.course_code?.trim()) {
    throw new Error("Course Code is required.");
  }

  if (!data.course_name?.trim()) {
    throw new Error("Course Name is required.");
  }

  if (!data.level) {
    throw new Error("Course Level is required.");
  }

  if (
    data.passing_percentage !== undefined &&
    (data.passing_percentage < 0 || data.passing_percentage > 100)
  ) {
    throw new Error("Passing Percentage must be between 0 and 100.");
  }
}
