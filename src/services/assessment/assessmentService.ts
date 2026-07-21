import type { Assessment } from "../../types/assessment";
import type { AssessmentForm } from "../../types/assessment";

import {
  getAssessments,
  createAssessment as repositoryCreateAssessment,
  updateAssessment,
  deleteAssessment,
  toggleAssessmentStatus as repositoryToggleAssessmentStatus,
} from "../../repositories/assessment/assessmentRepository";

export async function loadAssessments(): Promise<Assessment[]> {
  return await getAssessments();
}

export async function createAssessment(
  data: AssessmentForm
): Promise<Assessment> {
  validateAssessmentForm(data);

  // Reject duplicate assessment_code on create
  const existing = await getAssessments();
  const code = data.assessment_code.trim().toLowerCase();
  const duplicate = existing.some(
    (a) => (a.assessment_code ?? '').trim().toLowerCase() === code
  );
  if (duplicate) {
    throw new Error(`Assessment Code "${data.assessment_code.trim()}" already exists.`);
  }

  return await repositoryCreateAssessment(data);
}

export async function saveAssessment(
  id: string,
  data: Partial<AssessmentForm>
): Promise<Assessment> {
  if (!id) throw new Error("Invalid Assessment ID.");
  validateAssessmentForm(data);

  // Reject duplicate assessment_code on update (excluding self)
  if (data.assessment_code) {
    const existing = await getAssessments();
    const code = data.assessment_code.trim().toLowerCase();
    const duplicate = existing.some(
      (a) => (a.assessment_code ?? '').trim().toLowerCase() === code && a.id !== id
    );
    if (duplicate) {
      throw new Error(`Assessment Code "${data.assessment_code.trim()}" already exists.`);
    }
  }

  return await updateAssessment(id, data);
}

export async function removeAssessment(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Assessment ID.");
  await deleteAssessment(id);
}

export async function toggleAssessmentStatus(
  id: string,
  active: boolean
): Promise<Assessment> {
  if (!id) throw new Error("Invalid Assessment ID.");
  return await repositoryToggleAssessmentStatus(id, active);
}

function validateAssessmentForm(data: Partial<AssessmentForm>): void {
  if (!data.lesson_id)               throw new Error("Lesson is required.");
  if (!data.assessment_code?.trim()) throw new Error("Assessment Code is required.");
  if (!data.assessment_title?.trim()) throw new Error("Assessment Title is required.");
  if (!data.assessment_type)         throw new Error("Assessment Type is required.");

  if (
    data.passing_percentage !== undefined &&
    (data.passing_percentage < 0 || data.passing_percentage > 100)
  ) {
    throw new Error("Passing Percentage must be between 0 and 100.");
  }

  if (data.maximum_attempts !== undefined && data.maximum_attempts < 1) {
    throw new Error("Maximum Attempts must be at least 1.");
  }

  if (data.duration_minutes !== undefined) {
    if (data.duration_minutes < 1) {
      throw new Error("Duration must be at least 1 minute.");
    }
    if (data.duration_minutes > 600) {
      throw new Error("Duration cannot exceed 600 minutes.");
    }
  }

  if (data.question_timer_enabled && data.question_time_seconds !== undefined) {
    if (data.question_time_seconds < 5) {
      throw new Error("Question Timer must be at least 5 seconds.");
    }
    if (data.question_time_seconds > 600) {
      throw new Error("Question Timer cannot exceed 600 seconds.");
    }
  }

  if (
    data.negative_marking &&
    data.negative_marks !== undefined &&
    data.negative_marks < 0
  ) {
    throw new Error("Negative Marks cannot be negative.");
  }
}
