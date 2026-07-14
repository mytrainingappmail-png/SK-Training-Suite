import type { LearningPathEnrollment } from "../../types/learningPathEnrollment";
import type { LearningPathEnrollmentForm } from "../../types/learningPathEnrollment";
import type { EnrollmentType, EnrollmentStatus } from "../../types/learningPathEnrollment";

import {
  getEnrollments,
  createEnrollment as repositoryCreateEnrollment,
  updateEnrollment,
  deleteEnrollment,
  toggleActive as repositoryToggleActive,
} from "../../repositories/learningPathEnrollment/learningPathEnrollmentRepository";

const ALLOWED_TYPES: EnrollmentType[] = [
  "company", "branch", "department", "designation", "employee",
];

const ALLOWED_STATUSES: EnrollmentStatus[] = [
  "assigned", "in_progress", "completed", "cancelled",
];

export async function loadEnrollments(): Promise<LearningPathEnrollment[]> {
  return await getEnrollments();
}

export async function createEnrollment(
  data: LearningPathEnrollmentForm
): Promise<LearningPathEnrollment> {
  validateForm(data);

  const existing = await getEnrollments();
  assertNoDuplicateEmployee(data, existing);

  return await repositoryCreateEnrollment(data);
}

export async function saveEnrollment(
  id: string,
  data: LearningPathEnrollmentForm
): Promise<LearningPathEnrollment> {
  if (!id) throw new Error("Invalid Enrollment ID.");
  validateForm(data);

  const existing = await getEnrollments();
  assertNoDuplicateEmployee(data, existing, id);

  return await updateEnrollment(id, data);
}

export async function removeEnrollment(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Enrollment ID.");
  await deleteEnrollment(id);
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<LearningPathEnrollment> {
  if (!id) throw new Error("Invalid Enrollment ID.");
  return await repositoryToggleActive(id, active);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(data: LearningPathEnrollmentForm): void {
  if (!data.learning_path_id) {
    throw new Error("Learning Path is required.");
  }

  if (!data.enrollment_type) {
    throw new Error("Enrollment Type is required.");
  }

  if (!ALLOWED_TYPES.includes(data.enrollment_type)) {
    throw new Error(
      `Enrollment Type must be one of: ${ALLOWED_TYPES.join(", ")}.`
    );
  }

  if (!ALLOWED_STATUSES.includes(data.status)) {
    throw new Error(
      `Status must be one of: ${ALLOWED_STATUSES.join(", ")}.`
    );
  }

  if (data.start_date && data.end_date && data.start_date > data.end_date) {
    throw new Error("Start Date cannot be after End Date.");
  }
}

// Only enforce uniqueness for employee-type enrollments — an employee should
// not have two active enrollments for the same learning path simultaneously.
function assertNoDuplicateEmployee(
  data: LearningPathEnrollmentForm,
  existing: LearningPathEnrollment[],
  excludeId?: string
): void {
  if (data.enrollment_type !== "employee" || !data.employee_id) return;

  const duplicate = existing.find(
    (e) =>
      e.learning_path_id === data.learning_path_id &&
      e.employee_id      === data.employee_id &&
      e.active           === true &&
      (excludeId === undefined || e.id !== excludeId)
  );

  if (duplicate) {
    throw new Error(
      "This employee already has an active enrollment for the selected learning path."
    );
  }
}
