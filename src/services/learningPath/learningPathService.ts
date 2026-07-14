import type { LearningPath } from "../../types/learningPath";
import type { LearningPathForm } from "../../types/learningPath";
import type { DifficultyLevel } from "../../types/learningPath";

import {
  getLearningPaths,
  createLearningPath as repositoryCreateLearningPath,
  updateLearningPath,
  deleteLearningPath,
  toggleActive as repositoryToggleActive,
  togglePublished as repositoryTogglePublished,
} from "../../repositories/learningPath/learningPathRepository";

const ALLOWED_DIFFICULTY: DifficultyLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
];

export async function loadLearningPaths(): Promise<LearningPath[]> {
  return await getLearningPaths();
}

export async function createLearningPath(
  data: LearningPathForm
): Promise<LearningPath> {
  validateLearningPathForm(data);

  const existing = await getLearningPaths();
  assertUniqueCode(data.path_code, existing);

  return await repositoryCreateLearningPath(data);
}

export async function saveLearningPath(
  id: string,
  data: LearningPathForm
): Promise<LearningPath> {
  if (!id) throw new Error("Invalid Learning Path ID.");
  validateLearningPathForm(data);

  const existing = await getLearningPaths();
  assertUniqueCode(data.path_code, existing, id);

  return await updateLearningPath(id, data);
}

export async function removeLearningPath(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Learning Path ID.");
  await deleteLearningPath(id);
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<LearningPath> {
  if (!id) throw new Error("Invalid Learning Path ID.");
  return await repositoryToggleActive(id, active);
}

export async function togglePublished(
  id: string,
  published: boolean
): Promise<LearningPath> {
  if (!id) throw new Error("Invalid Learning Path ID.");
  return await repositoryTogglePublished(id, published);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateLearningPathForm(data: LearningPathForm): void {
  if (!data.path_code.trim()) {
    throw new Error("Path Code is required.");
  }

  if (!data.path_name.trim()) {
    throw new Error("Path Name is required.");
  }

  if (!ALLOWED_DIFFICULTY.includes(data.difficulty_level)) {
    throw new Error(
      `Difficulty Level must be one of: ${ALLOWED_DIFFICULTY.join(", ")}.`
    );
  }

  if (data.estimated_duration < 0) {
    throw new Error("Estimated Duration cannot be negative.");
  }

  if (data.display_order < 1) {
    throw new Error("Display Order must be greater than zero.");
  }
}

function assertUniqueCode(
  code: string,
  existing: LearningPath[],
  excludeId?: string
): void {
  const normalised = code.trim().toLowerCase();
  const duplicate = existing.find(
    (p) =>
      p.path_code.trim().toLowerCase() === normalised &&
      (excludeId === undefined || p.id !== excludeId)
  );

  if (duplicate) {
    throw new Error(`Path Code "${code.trim()}" already exists.`);
  }
}
