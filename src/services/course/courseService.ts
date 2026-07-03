import type { Course } from "../../types/course";
import type { CourseForm } from "../../types/course";

import {
  getAllCourses,
  getCourseById,
  createCourse as repositoryCreateCourse,
  updateCourse,
  deleteCourse,
  setCourseStatus,
} from "../../repositories/course/courseRepository";

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
