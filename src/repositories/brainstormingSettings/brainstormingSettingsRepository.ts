import { supabase } from "../../lib/supabase";
import type { BrainstormingSettings, BrainstormingSettingsForm } from "../../types/brainstormingSettings";

export async function getSettings(): Promise<BrainstormingSettings> {
  const { data, error } = await supabase
    .from("brainstorming_settings")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    console.error("[brainstormingSettingsRepository] getSettings:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateSettings(
  id: string,
  patch: Partial<BrainstormingSettingsForm>
): Promise<BrainstormingSettings> {
  const { data, error } = await supabase
    .from("brainstorming_settings")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[brainstormingSettingsRepository] updateSettings:", error);
    throw new Error(error.message);
  }

  return data;
}
