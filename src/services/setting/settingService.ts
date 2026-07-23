import type { Setting } from "../../types/setting";
import type { SettingForm } from "../../types/setting";

import {
  getSettings,
  createSetting as repositoryCreateSetting,
  updateSetting,
  deleteSetting,
  toggleActive as repositoryToggleActive,
  getSettingValueByKey,
} from "../../repositories/setting/settingRepository";

export async function loadSettings(): Promise<Setting[]> {
  return await getSettings();
}

export async function createSetting(data: SettingForm): Promise<Setting> {
  validateForm(data);

  const existing = await getSettings();
  assertUniqueKey(data.setting_key, existing);

  return await repositoryCreateSetting(data);
}

export async function saveSetting(
  id: string,
  data: SettingForm
): Promise<Setting> {
  if (!id) throw new Error("Invalid Setting ID.");
  validateForm(data);

  const existing = await getSettings();
  assertUniqueKey(data.setting_key, existing, id);

  return await updateSetting(id, data);
}

export async function removeSetting(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Setting ID.");
  await deleteSetting(id);
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<Setting> {
  if (!id) throw new Error("Invalid Setting ID.");
  return await repositoryToggleActive(id, active);
}

// Reads a config setting as a number, falling back to `fallback` if it
// doesn't exist, is inactive, or isn't a valid number — used by real
// runtime checks (login lockout threshold, upload size limits) so an admin
// changing the value in Settings actually changes app behaviour.
export async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const raw = await getSettingValueByKey(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(data: SettingForm): void {
  if (!data.setting_key.trim())   throw new Error("Setting Key is required.");
  if (!data.setting_value.trim()) throw new Error("Setting Value is required.");
  if (!data.setting_group.trim()) throw new Error("Setting Group is required.");
}

function assertUniqueKey(
  key: string,
  existing: Setting[],
  excludeId?: string
): void {
  const normalised = key.trim().toLowerCase();
  const duplicate = existing.find(
    (s) =>
      s.setting_key.trim().toLowerCase() === normalised &&
      (excludeId === undefined || s.id !== excludeId)
  );

  if (duplicate) {
    throw new Error(`Setting Key "${key.trim()}" already exists.`);
  }
}
