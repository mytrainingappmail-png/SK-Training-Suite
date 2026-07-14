import type { TrainingBatch } from "../../types/trainingBatch";
import type { TrainingBatchForm } from "../../types/trainingBatch";
import type { BatchStatus } from "../../types/trainingBatch";

import {
  getTrainingBatches,
  createTrainingBatch as repositoryCreate,
  updateTrainingBatch,
  deleteTrainingBatch,
  toggleIsActive as repositoryToggleIsActive,
} from "../../repositories/trainingBatch/trainingBatchRepository";

const ALLOWED_STATUSES: BatchStatus[] = [
  "PLANNED", "ONGOING", "COMPLETED", "CANCELLED",
];

export async function loadTrainingBatches(): Promise<TrainingBatch[]> {
  return await getTrainingBatches();
}

export async function createTrainingBatch(
  data: TrainingBatchForm
): Promise<TrainingBatch> {
  validateForm(data);

  const existing = await getTrainingBatches();
  assertUniqueBatchCode(data.batch_code, existing);

  return await repositoryCreate(data);
}

export async function saveTrainingBatch(
  id: string,
  data: TrainingBatchForm
): Promise<TrainingBatch> {
  if (!id) throw new Error("Invalid Training Batch ID.");
  validateForm(data);

  const existing = await getTrainingBatches();
  assertUniqueBatchCode(data.batch_code, existing, id);

  return await updateTrainingBatch(id, data);
}

export async function removeTrainingBatch(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Training Batch ID.");
  await deleteTrainingBatch(id);
}

export async function toggleIsActive(
  id: string,
  is_active: boolean
): Promise<TrainingBatch> {
  if (!id) throw new Error("Invalid Training Batch ID.");
  return await repositoryToggleIsActive(id, is_active);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(data: TrainingBatchForm): void {
  if (!data.batch_code.trim()) {
    throw new Error("Batch Code is required.");
  }

  if (!data.batch_name.trim()) {
    throw new Error("Batch Name is required.");
  }

  if (!ALLOWED_STATUSES.includes(data.status)) {
    throw new Error(
      `Status must be one of: ${ALLOWED_STATUSES.join(", ")}.`
    );
  }

  if (data.capacity < 0) {
    throw new Error("Capacity cannot be negative.");
  }

  if (data.enrolled_count < 0) {
    throw new Error("Enrolled Count cannot be negative.");
  }

  if (data.capacity > 0 && data.enrolled_count > data.capacity) {
    throw new Error("Enrolled Count cannot exceed Capacity.");
  }

  if (data.start_date && data.end_date && data.start_date > data.end_date) {
    throw new Error("Start Date cannot be after End Date.");
  }
}

function assertUniqueBatchCode(
  code: string,
  existing: TrainingBatch[],
  excludeId?: string
): void {
  const normalised = code.trim().toLowerCase();
  const duplicate = existing.find(
    (b) =>
      b.batch_code.trim().toLowerCase() === normalised &&
      (excludeId === undefined || b.id !== excludeId)
  );

  if (duplicate) {
    throw new Error(`Batch Code "${code.trim()}" already exists.`);
  }
}
