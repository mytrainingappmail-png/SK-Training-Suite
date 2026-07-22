// src/services/courseVisibility/courseVisibilityService.ts
//
// Business logic: which courses a given employee is allowed to see,
// based on their real designation_id and the course_visibility rules
// an admin has configured. A course with no visibility rules at all is
// visible to everyone — existing courses are never silently hidden.

import {
  getCourseVisibility,
  addCourseVisibility,
  removeCourseVisibility,
} from '../../repositories/courseVisibility/courseVisibilityRepository';

import { loadCourses } from '../course/courseService';
import { designationService } from '../designation/designationService';
import { employeeService } from '../employee/employeeService';

import type { CourseVisibility } from '../../types/courseVisibility';
import type { Course } from '../../types/course';
import type { Designation } from '../../types/designation';

export async function loadCourseVisibility(): Promise<CourseVisibility[]> {
  return getCourseVisibility();
}

export interface VisibilityMatrixChange {
  courseId: string;
  designationId: string;
  visible: boolean;
}

export async function saveVisibilityMatrixChanges(changes: VisibilityMatrixChange[]): Promise<void> {
  for (const change of changes) {
    if (change.visible) {
      await addCourseVisibility({ course_id: change.courseId, designation_id: change.designationId });
    } else {
      await removeCourseVisibility(change.courseId, change.designationId);
    }
  }
}

/**
 * Resolves the exact set of courses a given employee is allowed to see.
 * Courses with zero visibility rules are included for everyone; courses
 * with at least one rule are included only if the employee's own
 * designation is one of the allowed ones.
 */
export async function loadVisibleCoursesForEmployee(employeeId: string): Promise<Course[]> {
  const [employees, courses, visibilityRows] = await Promise.all([
    employeeService.getAll(),
    loadCourses(),
    getCourseVisibility(),
  ]);

  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) return [];

  const restrictedCourseIds = new Set(visibilityRows.map((v) => v.course_id));
  const allowedCourseIdsForDesignation = new Set(
    visibilityRows
      .filter((v) => v.designation_id === employee.designation_id)
      .map((v) => v.course_id)
  );

  return courses.filter((course) => {
    if (!restrictedCourseIds.has(course.id)) return true;
    return allowedCourseIdsForDesignation.has(course.id);
  });
}

export async function loadDesignationsForMatrix(): Promise<Designation[]> {
  return designationService.getAll();
}
