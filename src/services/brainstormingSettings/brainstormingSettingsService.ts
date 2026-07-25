import { getSettings, updateSettings } from "../../repositories/brainstormingSettings/brainstormingSettingsRepository";
import type { BrainstormingSettings, BrainstormingSettingsForm } from "../../types/brainstormingSettings";

export async function loadBrainstormingSettings(): Promise<BrainstormingSettings> {
  return getSettings();
}

export async function saveBrainstormingSettings(
  id: string,
  patch: Partial<BrainstormingSettingsForm>
): Promise<BrainstormingSettings> {
  if (!id) throw new Error("Invalid settings ID.");
  return updateSettings(id, patch);
}
