import type {
  CertificateGenerationQueueItem,
  CertificateGenerationQueueForm,
  GenerationStatus,
} from "../../types/certificateGeneration";

import {
  getQueue,
  createQueueItem as repositoryCreateQueueItem,
  updateQueueItem,
  deleteQueueItem,
  updateStatus as repositoryUpdateStatus,
  retryGeneration as repositoryRetryGeneration,
} from "../../repositories/certificateGeneration/certificateGenerationRepository";

const ALLOWED_STATUSES: GenerationStatus[] = [
  "pending",
  "processing",
  "completed",
  "failed",
];

export async function loadQueue(): Promise<CertificateGenerationQueueItem[]> {
  return await getQueue();
}

export async function createQueueItem(
  data: CertificateGenerationQueueForm
): Promise<CertificateGenerationQueueItem> {
  validateQueueItemForm(data);
  return await repositoryCreateQueueItem(data);
}

export async function saveQueueItem(
  id: string,
  data: CertificateGenerationQueueForm
): Promise<CertificateGenerationQueueItem> {
  if (!id) throw new Error("Invalid Queue Item ID.");
  validateQueueItemForm(data);
  return await updateQueueItem(id, data);
}

export async function removeQueueItem(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Queue Item ID.");
  await deleteQueueItem(id);
}

export async function updateStatus(
  id: string,
  status: GenerationStatus
): Promise<CertificateGenerationQueueItem> {
  if (!id) throw new Error("Invalid Queue Item ID.");

  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error(
      `Invalid status "${status}". Allowed values: ${ALLOWED_STATUSES.join(", ")}.`
    );
  }

  return await repositoryUpdateStatus(id, status);
}

export async function retryGeneration(
  id: string
): Promise<CertificateGenerationQueueItem> {
  if (!id) throw new Error("Invalid Queue Item ID.");
  return await repositoryRetryGeneration(id);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateQueueItemForm(data: CertificateGenerationQueueForm): void {
  if (!data.employee_id) {
    throw new Error("Employee is required.");
  }

  if (!data.assessment_result_id.trim()) {
    throw new Error("Assessment Result ID is required.");
  }

  if (!data.certificate_id.trim()) {
    throw new Error("Certificate ID is required.");
  }

  if (!data.template_id.trim()) {
    throw new Error("Template ID is required.");
  }

  if (!ALLOWED_STATUSES.includes(data.status)) {
    throw new Error(
      `Invalid status "${data.status}". Allowed: ${ALLOWED_STATUSES.join(", ")}.`
    );
  }

  if (data.priority < 1) {
    throw new Error("Priority must be greater than zero.");
  }

  if (data.retry_count < 0) {
    throw new Error("Retry Count cannot be negative.");
  }
}
