import type { Theme } from "../../types/theme";
import type { ThemeForm } from "../../types/theme";

import {
  getThemes,
  createTheme as repositoryCreateTheme,
  updateTheme,
  deleteTheme,
  toggleActive as repositoryToggleActive,
} from "../../repositories/theme/themeRepository";

export async function loadThemes(): Promise<Theme[]> {
  return await getThemes();
}

export async function createTheme(data: ThemeForm): Promise<Theme> {
  validateForm(data);

  const existing = await getThemes();
  assertUniqueName(data.theme_name, existing);

  return await repositoryCreateTheme(data);
}

export async function saveTheme(id: string, data: ThemeForm): Promise<Theme> {
  if (!id) throw new Error("Invalid Theme ID.");
  validateForm(data);

  const existing = await getThemes();
  assertUniqueName(data.theme_name, existing, id);

  return await updateTheme(id, data);
}

export async function removeTheme(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Theme ID.");
  await deleteTheme(id);
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<Theme> {
  if (!id) throw new Error("Invalid Theme ID.");
  return await repositoryToggleActive(id, active);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(data: ThemeForm): void {
  if (!data.theme_name.trim())    throw new Error("Theme Name is required.");
  if (!data.primary_color.trim()) throw new Error("Primary Color is required.");
  if (!data.sidebar_color.trim()) throw new Error("Sidebar Color is required.");
  if (!data.header_color.trim())  throw new Error("Header Color is required.");
  if (!data.font_family.trim())   throw new Error("Font Family is required.");
}

function assertUniqueName(
  name: string,
  existing: Theme[],
  excludeId?: string
): void {
  const normalised = name.trim().toLowerCase();
  const duplicate = existing.find(
    (t) =>
      t.theme_name.trim().toLowerCase() === normalised &&
      (excludeId === undefined || t.id !== excludeId)
  );

  if (duplicate) {
    throw new Error(`Theme Name "${name.trim()}" already exists.`);
  }
}
