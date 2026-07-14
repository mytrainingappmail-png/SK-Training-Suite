import type { LearningPathProgress } from "../../types/learningPathProgress";
import type { LearningPathProgressForm } from "../../types/learningPathProgress";
import type { ProgressStatus } from "../../types/learningPathProgress";

import {
  getProgress,
  createProgress as repositoryCreateProgress,
  updateProgress,
  deleteProgress,
  toggleActive as repositoryToggleActive,
} from "../../repositories/learningPathProgress/learningPathProgressRepository";

const ALLOWED_STATUSES: ProgressStatus[] = [
  "not_started",
  "in_progress",
  "completed",
  "cancelled",
];

export async function loadProgress(): Promise<LearningPathProgress[]> {
  return await getProgress();
}

export async function createProgress(
  data: LearningPathProgressForm
): Promise<LearningPathProgress> {
  validateForm(data);
  return await repositoryCreateProgress(data);
}

export async function saveProgress(
  id: string,
  data: LearningPathProgressForm
): Promise<LearningPathProgress> {
  if (!id) throw new Error("Invalid Progress ID.");
  validateForm(data);
  return await updateProgress(id, data);
}

export async function removeProgress(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Progress ID.");
  await deleteProgress(id);
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<LearningPathProgress> {
  if (!id) throw new Error("Invalid Progress ID.");
  return await repositoryToggleActive(id, active);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(data: LearningPathProgressForm): void {
  if (!data.enrollment_id.trim()) {
    throw new Error("Enrollment ID is required.");
  }

  if (!data.learning_path_id) {
    throw new Error("Learning Path is required.");
  }

  if (!data.employee_id) {
    throw new Error("Employee is required.");
  }

  if (data.progress_percentage < 0 || data.progress_percentage > 100) {
    throw new Error("Progress Percentage must be between 0 and 100.");
  }

  if (data.total_courses > 0 && data.completed_courses > data.total_courses) {
    throw new Error("Completed Courses cannot exceed Total Courses.");
  }

  if (!ALLOWED_STATUSES.includes(data.status)) {
    throw new Error(
      `Status must be one of: ${ALLOWED_STATUSES.join(", ")}.`
    );
  }
}
