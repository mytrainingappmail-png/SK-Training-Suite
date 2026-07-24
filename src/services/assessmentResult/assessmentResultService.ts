import type { AssessmentResult } from "../../types/assessmentResult";
import type { AssessmentResultForm } from "../../types/assessmentResult";

import {
  getResults,
  createResult as repositoryCreateResult,
  updateResult,
  deleteResult,
  togglePublished as repositoryTogglePublished,
} from "../../repositories/assessmentResult/assessmentResultRepository";

export async function loadResults(): Promise<AssessmentResult[]> {
  return await getResults();
}

export async function createResult(
  data: AssessmentResultForm
): Promise<AssessmentResult> {
  validateResultForm(data);
  return await repositoryCreateResult(normalizeResultForm(data));
}

export async function saveResult(
  id: string,
  data: AssessmentResultForm
): Promise<AssessmentResult> {
  if (!id) throw new Error("Invalid Result ID.");
  validateResultForm(data);
  return await updateResult(id, normalizeResultForm(data));
}

// "Evaluated At" is the only optional field on this form (everything else
// has a required-field check in validateResultForm) - left blank, it comes
// through as "", which Postgres rejects for a timestamptz column ("invalid
// input syntax for type timestamp with time zone"). Every other reader of
// this field (certificates, reports, employee-facing results) assumes it's
// always a real date, so default to "now" rather than storing null.
function normalizeResultForm(data: AssessmentResultForm): AssessmentResultForm {
  return {
    ...data,
    evaluated_at: data.evaluated_at?.trim() ? data.evaluated_at : new Date().toISOString(),
  };
}

export async function removeResult(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Result ID.");
  await deleteResult(id);
}

export async function togglePublished(
  id: string,
  published: boolean
): Promise<AssessmentResult> {
  if (!id) throw new Error("Invalid Result ID.");
  return await repositoryTogglePublished(id, published);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateResultForm(data: AssessmentResultForm): void {
  if (!data.assessment_id) throw new Error("Assessment is required.");
  if (!data.employee_id)   throw new Error("Employee is required.");
  if (!data.attempt_id)    throw new Error("Attempt is required.");

  if (data.percentage < 0 || data.percentage > 100) {
    throw new Error("Percentage must be between 0 and 100.");
  }

  if (data.obtained_marks > data.total_marks) {
    throw new Error("Obtained Marks cannot exceed Total Marks.");
  }

  if (data.rank < 1) {
    throw new Error("Rank must be greater than zero.");
  }
}
