import { supabase } from "../../lib/supabase";
import type { MenuPermission } from "../../types/menuPermission";
import type { MenuPermissionForm } from "../../types/menuPermission";
import { getRoles } from "../role/roleRepository";

// menu_permissions has no company_id column of its own (it joins through
// role_id) -- scoped by first resolving the caller's own roles, then
// filtering to just those. See branchRepository.ts for why this can't be
// left to RLS alone.
export async function getMenuPermissions(): Promise<MenuPermission[]> {
  const myRoles = await getRoles();
  const roleIds = myRoles.map((r) => r.id);
  if (roleIds.length === 0) return [];
  const { data, error } = await supabase
    .from("menu_permissions")
    .select("*")
    .in("role_id", roleIds)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[menuPermissionRepository] getMenuPermissions:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getMenusByRole(
  roleId: string
): Promise<MenuPermission[]> {
  const { data, error } = await supabase
    .from("menu_permissions")
    .select("*")
    .eq("role_id", roleId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[menuPermissionRepository] getMenusByRole:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function assignMenu(
  item: MenuPermissionForm
): Promise<MenuPermission> {
  const { data, error } = await supabase
    .from("menu_permissions")
    .insert(item)
    .select()
    .single();

  if (error) {
    console.error("[menuPermissionRepository] assignMenu:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function removeMenu(
  roleId: string,
  menuId: string
): Promise<void> {
  const { error } = await supabase
    .from("menu_permissions")
    .delete()
    .eq("role_id", roleId)
    .eq("menu_id", menuId);

  if (error) {
    console.error("[menuPermissionRepository] removeMenu:", error);
    throw new Error(error.message);
  }
}

export async function replaceMenus(
  roleId: string,
  menuIds: string[]
): Promise<void> {
  // Delete all existing menu mappings for this role
  const { error: deleteError } = await supabase
    .from("menu_permissions")
    .delete()
    .eq("role_id", roleId);

  if (deleteError) {
    console.error("[menuPermissionRepository] replaceMenus (delete):", deleteError);
    throw new Error(deleteError.message);
  }

  if (menuIds.length === 0) return;

  // Insert all new mappings
  const rows = menuIds.map((menu_id) => ({
    role_id: roleId,
    menu_id,
  }));

  const { error: insertError } = await supabase
    .from("menu_permissions")
    .insert(rows);

  if (insertError) {
    console.error("[menuPermissionRepository] replaceMenus (insert):", insertError);
    throw new Error(insertError.message);
  }
}
