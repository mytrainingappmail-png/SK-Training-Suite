import type { TrainerAssignment } from "../../types/trainerAssignment";
import type { TrainerAssignmentForm } from "../../types/trainerAssignment";

import {
  getTrainerAssignments,
  createTrainerAssignment as repositoryCreate,
  updateTrainerAssignment,
  deleteTrainerAssignment,
  toggleIsActive as repositoryToggleIsActive,
} from "../../repositories/trainerAssignment/trainerAssignmentRepository";

export async function loadTrainerAssignments(): Promise<TrainerAssignment[]> {
  return await getTrainerAssignments();
}

export async function createTrainerAssignment(
  data: TrainerAssignmentForm
): Promise<TrainerAssignment> {
  validateForm(data);

  const existing = await getTrainerAssignments();
  assertNoDuplicatePrimary(data, existing);

  return await repositoryCreate(data);
}

export async function saveTrainerAssignment(
  id: string,
  data: TrainerAssignmentForm
): Promise<TrainerAssignment> {
  if (!id) throw new Error("Invalid Trainer Assignment ID.");
  validateForm(data);

  const existing = await getTrainerAssignments();
  assertNoDuplicatePrimary(data, existing, id);

  return await updateTrainerAssignment(id, data);
}

export async function removeTrainerAssignment(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Trainer Assignment ID.");
  await deleteTrainerAssignment(id);
}

export async function toggleTrainerAssignmentStatus(
  id: string,
  is_active: boolean
): Promise<TrainerAssignment> {
  if (!id) throw new Error("Invalid Trainer Assignment ID.");
  return await repositoryToggleIsActive(id, is_active);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(data: TrainerAssignmentForm): void {
  if (!data.company_id) {
    throw new Error("Company is required.");
  }

  if (!data.batch_id) {
    throw new Error("Training Batch is required.");
  }

  if (!data.trainer_id) {
    throw new Error("Trainer is required.");
  }

  if (data.assigned_from && data.assigned_to && data.assigned_to < data.assigned_from) {
    throw new Error("Assigned To cannot be before Assigned From.");
  }
}

// Prevent duplicate active PRIMARY trainer for the same batch
function assertNoDuplicatePrimary(
  data: TrainerAssignmentForm,
  existing: TrainerAssignment[],
  excludeId?: string
): void {
  if (data.assignment_type !== "PRIMARY") return;

  const duplicate = existing.find(
    (a) =>
      a.batch_id        === data.batch_id &&
      a.assignment_type === "PRIMARY" &&
      a.is_active       === true &&
      (excludeId === undefined || a.id !== excludeId)
  );

  if (duplicate) {
    throw new Error(
      "This batch already has an active PRIMARY trainer. Only one active PRIMARY trainer is allowed per batch."
    );
  }
}
