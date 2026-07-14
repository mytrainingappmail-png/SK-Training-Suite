import type { Enrollment } from "../../types/enrollment";
import type { EnrollmentForm } from "../../types/enrollment";
import type { AssignmentType, EnrollmentType, EnrollmentStatus } from "../../types/enrollment";

import {
  getEnrollments,
  createEnrollment as repositoryCreateEnrollment,
  updateEnrollment,
  deleteEnrollment,
  cancelEnrollment as repositoryCancelEnrollment,
  toggleIsActive as repositoryToggleIsActive,
} from "../../repositories/enrollment/enrollmentRepository";

const ALLOWED_ASSIGNMENT_TYPES: AssignmentType[] = [
  "MANUAL", "AUTO", "BULK", "IMPORT", "API",
];

const ALLOWED_ENROLLMENT_TYPES: EnrollmentType[] = [
  "COURSE", "LEARNING_PATH",
];

const ALLOWED_STATUSES: EnrollmentStatus[] = [
  "PENDING", "IN_PROGRESS", "COMPLETED", "EXPIRED", "CANCELLED",
];

export async function loadEnrollments(): Promise<Enrollment[]> {
  return await getEnrollments();
}

export async function createEnrollment(
  data: EnrollmentForm
): Promise<Enrollment> {
  validateForm(data);
  return await repositoryCreateEnrollment(data);
}

export async function saveEnrollment(
  id: string,
  data: EnrollmentForm
): Promise<Enrollment> {
  if (!id) throw new Error("Invalid Enrollment ID.");
  validateForm(data);
  return await updateEnrollment(id, data);
}

export async function removeEnrollment(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Enrollment ID.");
  await deleteEnrollment(id);
}

export async function cancelEnrollment(id: string): Promise<Enrollment> {
  if (!id) throw new Error("Invalid Enrollment ID.");
  return await repositoryCancelEnrollment(id);
}

export async function toggleIsActive(
  id: string,
  is_active: boolean
): Promise<Enrollment> {
  if (!id) throw new Error("Invalid Enrollment ID.");
  return await repositoryToggleIsActive(id, is_active);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(data: EnrollmentForm): void {
  if (!data.employee_id) {
    throw new Error("Employee is required.");
  }

  if (!data.enrollment_type) {
    throw new Error("Enrollment Type is required.");
  }

  if (!ALLOWED_ENROLLMENT_TYPES.includes(data.enrollment_type)) {
    throw new Error(
      `Enrollment Type must be one of: ${ALLOWED_ENROLLMENT_TYPES.join(", ")}.`
    );
  }

  if (data.enrollment_type === "COURSE" && !data.course_id) {
    throw new Error("Course is required for COURSE enrollment type.");
  }

  if (data.enrollment_type === "LEARNING_PATH" && !data.learning_path_id) {
    throw new Error("Learning Path is required for LEARNING_PATH enrollment type.");
  }

  if (!ALLOWED_ASSIGNMENT_TYPES.includes(data.assignment_type)) {
    throw new Error(
      `Assignment Type must be one of: ${ALLOWED_ASSIGNMENT_TYPES.join(", ")}.`
    );
  }

  if (!ALLOWED_STATUSES.includes(data.status)) {
    throw new Error(
      `Status must be one of: ${ALLOWED_STATUSES.join(", ")}.`
    );
  }

  if (data.start_date && data.due_date && data.start_date > data.due_date) {
    throw new Error("Start Date cannot be after Due Date.");
  }

  if (
    data.completion_percentage < 0 ||
    data.completion_percentage > 100
  ) {
    throw new Error("Completion Percentage must be between 0 and 100.");
  }
}
