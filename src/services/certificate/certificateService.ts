import type { Certificate } from "../../types/certificate";
import type { CertificateForm } from "../../types/certificate";

import {
  getCertificates,
  createCertificate as repositoryCreateCertificate,
  updateCertificate,
  deleteCertificate,
  togglePublished as repositoryTogglePublished,
  toggleActive as repositoryToggleActive,
} from "../../repositories/certificate/certificateRepository";

export async function loadCertificates(): Promise<Certificate[]> {
  return await getCertificates();
}

export async function createCertificate(
  data: CertificateForm
): Promise<Certificate> {
  validateCertificateForm(data);

  const existing = await getCertificates();
  assertUniqueCertificateNo(data.certificate_no, existing);

  return await repositoryCreateCertificate(data);
}

export async function saveCertificate(
  id: string,
  data: CertificateForm
): Promise<Certificate> {
  if (!id) throw new Error("Invalid Certificate ID.");
  validateCertificateForm(data);

  const existing = await getCertificates();
  assertUniqueCertificateNo(data.certificate_no, existing, id);

  return await updateCertificate(id, data);
}

export async function removeCertificate(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Certificate ID.");
  await deleteCertificate(id);
}

export async function togglePublished(
  id: string,
  published: boolean
): Promise<Certificate> {
  if (!id) throw new Error("Invalid Certificate ID.");
  return await repositoryTogglePublished(id, published);
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<Certificate> {
  if (!id) throw new Error("Invalid Certificate ID.");
  return await repositoryToggleActive(id, active);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateCertificateForm(data: CertificateForm): void {
  if (!data.certificate_no.trim()) {
    throw new Error("Certificate Number is required.");
  }

  if (!data.certificate_title.trim()) {
    throw new Error("Certificate Title is required.");
  }

  if (!data.issue_date) {
    throw new Error("Issue Date is required.");
  }

  if (data.expiry_date && data.expiry_date < data.issue_date) {
    throw new Error("Expiry Date cannot be earlier than Issue Date.");
  }
}

function assertUniqueCertificateNo(
  certificateNo: string,
  existing: Certificate[],
  excludeId?: string
): void {
  const no = certificateNo.trim().toLowerCase();
  const duplicate = existing.find(
    (c) =>
      c.certificate_no.trim().toLowerCase() === no &&
      (excludeId === undefined || c.id !== excludeId)
  );

  if (duplicate) {
    throw new Error(
      `Certificate Number "${certificateNo.trim()}" already exists.`
    );
  }
}
