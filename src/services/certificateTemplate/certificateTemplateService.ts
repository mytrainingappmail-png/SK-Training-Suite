import type { CertificateTemplate } from "../../types/certificateTemplate";
import type { CertificateTemplateForm } from "../../types/certificateTemplate";

import {
  getTemplates,
  createTemplate as repositoryCreateTemplate,
  updateTemplate,
  deleteTemplate,
  toggleActive as repositoryToggleActive,
  setDefaultTemplate as repositorySetDefaultTemplate,
} from "../../repositories/certificateTemplate/certificateTemplateRepository";

export async function loadTemplates(): Promise<CertificateTemplate[]> {
  return await getTemplates();
}

export async function createTemplate(
  data: CertificateTemplateForm
): Promise<CertificateTemplate> {
  validateTemplateForm(data);

  const existing = await getTemplates();
  assertUniqueCode(data.template_code, existing);

  if (data.default_template) {
    assertNoOtherDefault(existing);
  }

  return await repositoryCreateTemplate(data);
}

export async function saveTemplate(
  id: string,
  data: CertificateTemplateForm
): Promise<CertificateTemplate> {
  if (!id) throw new Error("Invalid Template ID.");
  validateTemplateForm(data);

  const existing = await getTemplates();
  assertUniqueCode(data.template_code, existing, id);

  if (data.default_template) {
    const otherDefault = existing.find(
      (t) => t.default_template && t.id !== id
    );
    if (otherDefault) {
      throw new Error(
        `"${otherDefault.template_name}" is already the default template. Only one default template is allowed.`
      );
    }
  }

  return await updateTemplate(id, data);
}

export async function removeTemplate(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Template ID.");
  await deleteTemplate(id);
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<CertificateTemplate> {
  if (!id) throw new Error("Invalid Template ID.");
  return await repositoryToggleActive(id, active);
}

export async function setDefaultTemplate(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Template ID.");
  await repositorySetDefaultTemplate(id);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateTemplateForm(data: CertificateTemplateForm): void {
  if (!data.template_name.trim()) {
    throw new Error("Template Name is required.");
  }

  if (!data.template_code.trim()) {
    throw new Error("Template Code is required.");
  }

  if (data.font_size <= 0) {
    throw new Error("Font Size must be greater than zero.");
  }
}

function assertUniqueCode(
  code: string,
  existing: CertificateTemplate[],
  excludeId?: string
): void {
  const normalised = code.trim().toLowerCase();
  const duplicate = existing.find(
    (t) =>
      t.template_code.trim().toLowerCase() === normalised &&
      (excludeId === undefined || t.id !== excludeId)
  );

  if (duplicate) {
    throw new Error(
      `Template Code "${code.trim()}" already exists.`
    );
  }
}

function assertNoOtherDefault(existing: CertificateTemplate[]): void {
  const current = existing.find((t) => t.default_template);
  if (current) {
    throw new Error(
      `"${current.template_name}" is already the default template. Only one default template is allowed.`
    );
  }
}
