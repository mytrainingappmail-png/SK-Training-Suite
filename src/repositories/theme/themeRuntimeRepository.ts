import { supabase } from "../../lib/supabase";

export interface ActiveThemeRow {
  primary_color: string;
  secondary_color: string;
  sidebar_color: string;
  header_color: string;
}

// Safe to call with no session (via the get_active_theme SECURITY DEFINER
// RPC) — needed on the pre-login page.
export async function getActiveTheme(): Promise<ActiveThemeRow | null> {
  const { data, error } = await supabase.rpc("get_active_theme");

  if (error) {
    console.error("[themeRuntimeRepository] getActiveTheme:", error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}
