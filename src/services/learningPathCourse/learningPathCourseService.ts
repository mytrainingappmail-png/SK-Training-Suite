import type { LearningPathCourse } from "../../types/learningPathCourse";
import type { LearningPathCourseForm } from "../../types/learningPathCourse";

import {
  getLearningPathCourses,
  createLearningPathCourse as repositoryCreate,
  updateLearningPathCourse,
  deleteLearningPathCourse,
  toggleActive as repositoryToggleActive,
} from "../../repositories/learningPathCourse/learningPathCourseRepository";

export async function loadLearningPathCourses(): Promise<LearningPathCourse[]> {
  return await getLearningPathCourses();
}

export async function createLearningPathCourse(
  data: LearningPathCourseForm
): Promise<LearningPathCourse> {
  validateForm(data);

  const existing = await getLearningPathCourses();
  assertNoDuplicate(data.learning_path_id, data.course_id, existing);

  return await repositoryCreate(data);
}

export async function saveLearningPathCourse(
  id: string,
  data: LearningPathCourseForm
): Promise<LearningPathCourse> {
  if (!id) throw new Error("Invalid Learning Path Course ID.");
  validateForm(data);

  const existing = await getLearningPathCourses();
  assertNoDuplicate(data.learning_path_id, data.course_id, existing, id);

  return await updateLearningPathCourse(id, data);
}

export async function removeLearningPathCourse(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Learning Path Course ID.");
  await deleteLearningPathCourse(id);
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<LearningPathCourse> {
  if (!id) throw new Error("Invalid Learning Path Course ID.");
  return await repositoryToggleActive(id, active);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(data: LearningPathCourseForm): void {
  if (!data.learning_path_id) {
    throw new Error("Learning Path is required.");
  }

  if (!data.course_id) {
    throw new Error("Course is required.");
  }

  if (data.sequence_no < 1) {
    throw new Error("Sequence Number must be greater than zero.");
  }

  if (data.estimated_duration < 0) {
    throw new Error("Estimated Duration cannot be negative.");
  }
}

function assertNoDuplicate(
  learningPathId: string,
  courseId: string,
  existing: LearningPathCourse[],
  excludeId?: string
): void {
  const duplicate = existing.find(
    (item) =>
      item.learning_path_id === learningPathId &&
      item.course_id        === courseId &&
      (excludeId === undefined || item.id !== excludeId)
  );

  if (duplicate) {
    throw new Error(
      "This course is already added to the selected learning path."
    );
  }
}
