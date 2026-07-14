import { supabase } from "../../lib/supabase";
import type { Menu } from "../../types/menu";
import type { MenuForm } from "../../types/menu";

export async function getMenus(): Promise<Menu[]> {
  const { data, error } = await supabase
    .from("menus")
    .select("*")
    .order("menu_level",    { ascending: true })
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[menuRepository] getMenus:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getMenu(id: string): Promise<Menu> {
  const { data, error } = await supabase
    .from("menus")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[menuRepository] getMenu:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createMenu(menu: MenuForm): Promise<Menu> {
  const { data, error } = await supabase
    .from("menus")
    .insert(menu)
    .select()
    .single();

  if (error) {
    console.error("[menuRepository] createMenu:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateMenu(
  id: string,
  menu: Partial<MenuForm>
): Promise<Menu> {
  const { data, error } = await supabase
    .from("menus")
    .update(menu)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[menuRepository] updateMenu:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteMenu(id: string): Promise<void> {
  const { error } = await supabase
    .from("menus")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[menuRepository] deleteMenu:", error);
    throw new Error(error.message);
  }
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<Menu> {
  const { data, error } = await supabase
    .from("menus")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[menuRepository] toggleActive:", error);
    throw new Error(error.message);
  }

  return data;
}
