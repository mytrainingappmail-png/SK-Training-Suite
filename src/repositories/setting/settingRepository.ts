import { supabase } from "../../lib/supabase";
import type { Setting } from "../../types/setting";
import type { SettingForm } from "../../types/setting";

export async function getSettings(): Promise<Setting[]> {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .order("setting_group", { ascending: true })
    .order("setting_key",   { ascending: true });

  if (error) {
    console.error("[settingRepository] getSettings:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getSetting(id: string): Promise<Setting> {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[settingRepository] getSetting:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createSetting(setting: SettingForm): Promise<Setting> {
  const { data, error } = await supabase
    .from("settings")
    .insert(setting)
    .select()
    .single();

  if (error) {
    console.error("[settingRepository] createSetting:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateSetting(
  id: string,
  setting: Partial<SettingForm>
): Promise<Setting> {
  const { data, error } = await supabase
    .from("settings")
    .update(setting)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[settingRepository] updateSetting:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteSetting(id: string): Promise<void> {
  const { error } = await supabase
    .from("settings")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[settingRepository] deleteSetting:", error);
    throw new Error(error.message);
  }
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<Setting> {
  const { data, error } = await supabase
    .from("settings")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[settingRepository] toggleActive:", error);
    throw new Error(error.message);
  }

  return data;
}

// Reads a single setting's value by key, safe to call with no session (via
// the get_setting_value SECURITY DEFINER RPC) — used by config checks that
// run before login completes (e.g. max_login_attempts).
export async function getSettingValueByKey(key: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_setting_value", { p_key: key });

  if (error) {
    console.error("[settingRepository] getSettingValueByKey:", error);
    return null;
  }

  return data ?? null;
}
