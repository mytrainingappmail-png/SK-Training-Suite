import { supabase } from "../../lib/supabase";
import type { Theme } from "../../types/theme";
import type { ThemeForm } from "../../types/theme";

export async function getThemes(): Promise<Theme[]> {
  const { data, error } = await supabase
    .from("themes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[themeRepository] getThemes:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getTheme(id: string): Promise<Theme> {
  const { data, error } = await supabase
    .from("themes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[themeRepository] getTheme:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createTheme(theme: ThemeForm): Promise<Theme> {
  const { data, error } = await supabase
    .from("themes")
    .insert(theme)
    .select()
    .single();

  if (error) {
    console.error("[themeRepository] createTheme:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateTheme(
  id: string,
  theme: Partial<ThemeForm>
): Promise<Theme> {
  const { data, error } = await supabase
    .from("themes")
    .update(theme)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[themeRepository] updateTheme:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteTheme(id: string): Promise<void> {
  const { error } = await supabase
    .from("themes")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[themeRepository] deleteTheme:", error);
    throw new Error(error.message);
  }
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<Theme> {
  const { data, error } = await supabase
    .from("themes")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[themeRepository] toggleActive:", error);
    throw new Error(error.message);
  }

  return data;
}
