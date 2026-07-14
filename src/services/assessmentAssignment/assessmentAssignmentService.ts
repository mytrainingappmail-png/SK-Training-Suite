import type { AssessmentAssignment } from "../../types/assessmentAssignment";
import type { AssessmentAssignmentForm } from "../../types/assessmentAssignment";
import type { AssignmentType } from "../../types/assessmentAssignment";

import {
  getAssignments,
  createAssignment as repositoryCreateAssignment,
  updateAssignment,
  deleteAssignment,
  toggleAssignmentStatus as repositoryToggleAssignmentStatus,
} from "../../repositories/assessmentAssignment/assessmentAssignmentRepository";

// ─── Public API ────────────────────────────────────────────────────────────────

export async function loadAssignments(): Promise<AssessmentAssignment[]> {
  return await getAssignments();
}

export async function createAssignment(
  data: AssessmentAssignmentForm
): Promise<AssessmentAssignment> {
  validateAssignmentForm(data);

  const existing = await getAssignments();
  assertNoDuplicate(data, existing);

  return await repositoryCreateAssignment(data);
}

export async function saveAssignment(
  id: string,
  data: AssessmentAssignmentForm
): Promise<AssessmentAssignment> {
  if (!id) throw new Error("Invalid Assignment ID.");
  validateAssignmentForm(data);

  const existing = await getAssignments();
  assertNoDuplicate(data, existing, id);

  return await updateAssignment(id, data);
}

export async function removeAssignment(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Assignment ID.");
  await deleteAssignment(id);
}

export async function toggleAssignmentStatus(
  id: string,
  active: boolean
): Promise<AssessmentAssignment> {
  if (!id) throw new Error("Invalid Assignment ID.");
  return await repositoryToggleAssignmentStatus(id, active);
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateAssignmentForm(data: AssessmentAssignmentForm): void {
  if (!data.assessment_id)  throw new Error("Assessment is required.");
  if (!data.assignment_type) throw new Error("Assignment Type is required.");

  validateTarget(data.assignment_type, data);

  if (data.maximum_attempts < 1) {
    throw new Error("Maximum Attempts must be at least 1.");
  }

  if (data.start_date && data.end_date && data.start_date > data.end_date) {
    throw new Error("Start Date cannot be after End Date.");
  }
}

function validateTarget(
  type: AssignmentType,
  data: AssessmentAssignmentForm
): void {
  const required: Record<AssignmentType, { field: keyof AssessmentAssignmentForm; label: string }> = {
    company:     { field: "company_id",     label: "Company"     },
    branch:      { field: "branch_id",      label: "Branch"      },
    department:  { field: "department_id",  label: "Department"  },
    designation: { field: "designation_id", label: "Designation" },
    employee:    { field: "employee_id",    label: "Employee"    },
  };

  const { field, label } = required[type];

  if (!data[field]) {
    throw new Error(`${label} is required for assignment type "${type}".`);
  }
}

function assertNoDuplicate(
  data: AssessmentAssignmentForm,
  existing: AssessmentAssignment[],
  excludeId?: string
): void {
  const targetFieldMap: Record<AssignmentType, keyof AssessmentAssignment> = {
    company:     "company_id",
    branch:      "branch_id",
    department:  "department_id",
    designation: "designation_id",
    employee:    "employee_id",
  };

  const targetField = targetFieldMap[data.assignment_type];
  const targetValue = data[targetField as keyof AssessmentAssignmentForm] as string;

  const duplicate = existing.find((a) => {
    if (excludeId && a.id === excludeId)          return false;
    if (a.assessment_id !== data.assessment_id)   return false;
    if (a.assignment_type !== data.assignment_type) return false;
    return (a[targetField] as string) === targetValue;
  });

  if (duplicate) {
    throw new Error(
      `This assessment is already assigned to the selected ${data.assignment_type}.`
    );
  }
}
