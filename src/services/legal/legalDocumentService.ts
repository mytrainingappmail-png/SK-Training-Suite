import { getAll, getBySlug, update } from "../../repositories/legal/legalDocumentRepository";
import type { LegalDocument } from "../../types/legalDocument";

export async function loadAllDocuments(): Promise<LegalDocument[]> {
  return getAll();
}

export async function loadDocument(slug: string): Promise<LegalDocument | null> {
  return getBySlug(slug);
}

export async function saveDocumentContent(id: string, contentHtml: string): Promise<LegalDocument> {
  if (!id) throw new Error("Invalid document ID.");
  return update(id, contentHtml);
}
