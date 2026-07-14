import type { Menu } from "../../types/menu";
import type { MenuForm } from "../../types/menu";

import {
  getMenus,
  createMenu as repositoryCreateMenu,
  updateMenu,
  deleteMenu,
  toggleActive as repositoryToggleActive,
} from "../../repositories/menu/menuRepository";

export async function loadMenus(): Promise<Menu[]> {
  return await getMenus();
}

export async function createMenu(data: MenuForm): Promise<Menu> {
  validateForm(data);

  const existing = await getMenus();
  assertUniqueCode(data.menu_code, existing);

  return await repositoryCreateMenu(data);
}

export async function saveMenu(id: string, data: MenuForm): Promise<Menu> {
  if (!id) throw new Error("Invalid Menu ID.");
  validateForm(data);

  const existing = await getMenus();
  assertUniqueCode(data.menu_code, existing, id);

  return await updateMenu(id, data);
}

export async function removeMenu(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Menu ID.");
  await deleteMenu(id);
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<Menu> {
  if (!id) throw new Error("Invalid Menu ID.");
  return await repositoryToggleActive(id, active);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(data: MenuForm): void {
  if (!data.menu_code.trim()) {
    throw new Error("Menu Code is required.");
  }

  if (!data.menu_name.trim()) {
    throw new Error("Menu Name is required.");
  }

  if (!data.route_path.trim()) {
    throw new Error("Route Path is required.");
  }

  if (data.display_order < 0) {
    throw new Error("Display Order must be zero or greater.");
  }

  if (data.menu_level < 1) {
    throw new Error("Menu Level must be greater than zero.");
  }
}

function assertUniqueCode(
  code: string,
  existing: Menu[],
  excludeId?: string
): void {
  const normalised = code.trim().toLowerCase();
  const duplicate = existing.find(
    (m) =>
      m.menu_code.trim().toLowerCase() === normalised &&
      (excludeId === undefined || m.id !== excludeId)
  );

  if (duplicate) {
    throw new Error(`Menu Code "${code.trim()}" already exists.`);
  }
}
