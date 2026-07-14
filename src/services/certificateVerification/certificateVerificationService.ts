import type {
  CertificateVerification,
  CertificateVerificationForm,
  VerificationStatus,
} from "../../types/certificateVerification";

import {
  getVerifications,
  createVerification as repositoryCreateVerification,
  updateVerification,
  deleteVerification,
  toggleActive as repositoryToggleActive,
  incrementVerificationCount as repositoryIncrementVerificationCount,
} from "../../repositories/certificateVerification/certificateVerificationRepository";

const ALLOWED_STATUSES: VerificationStatus[] = ["active", "expired", "revoked"];

export async function loadVerifications(): Promise<CertificateVerification[]> {
  return await getVerifications();
}

export async function createVerification(
  data: CertificateVerificationForm
): Promise<CertificateVerification> {
  validateVerificationForm(data);

  const existing = await getVerifications();
  assertUniqueCode(data.verification_code, existing);

  return await repositoryCreateVerification(data);
}

export async function saveVerification(
  id: string,
  data: CertificateVerificationForm
): Promise<CertificateVerification> {
  if (!id) throw new Error("Invalid Verification ID.");
  validateVerificationForm(data);

  const existing = await getVerifications();
  assertUniqueCode(data.verification_code, existing, id);

  return await updateVerification(id, data);
}

export async function removeVerification(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Verification ID.");
  await deleteVerification(id);
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<CertificateVerification> {
  if (!id) throw new Error("Invalid Verification ID.");
  return await repositoryToggleActive(id, active);
}

export async function incrementVerificationCount(
  id: string
): Promise<CertificateVerification> {
  if (!id) throw new Error("Invalid Verification ID.");
  return await repositoryIncrementVerificationCount(id);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateVerificationForm(data: CertificateVerificationForm): void {
  if (!data.verification_code.trim()) {
    throw new Error("Verification Code is required.");
  }

  if (!ALLOWED_STATUSES.includes(data.verification_status)) {
    throw new Error(
      `Verification Status must be one of: ${ALLOWED_STATUSES.join(", ")}.`
    );
  }

  if (data.verified_count < 0) {
    throw new Error("Verified Count cannot be negative.");
  }

  if (data.expires_at) {
    const today = new Date().toISOString().slice(0, 10);
    if (data.expires_at < today) {
      throw new Error("Expiry Date must not be earlier than today.");
    }
  }
}

function assertUniqueCode(
  code: string,
  existing: CertificateVerification[],
  excludeId?: string
): void {
  const normalised = code.trim().toLowerCase();
  const duplicate = existing.find(
    (v) =>
      v.verification_code.trim().toLowerCase() === normalised &&
      (excludeId === undefined || v.id !== excludeId)
  );

  if (duplicate) {
    throw new Error(
      `Verification Code "${code.trim()}" already exists.`
    );
  }
}
