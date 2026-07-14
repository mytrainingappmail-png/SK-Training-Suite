import { supabase } from "../../lib/supabase";
import type { RolePermission } from "../../types/rolePermission";
import type { RolePermissionForm } from "../../types/rolePermission";

export async function getRolePermissions(): Promise<RolePermission[]> {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[rolePermissionRepository] getRolePermissions:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getPermissionsByRole(
  roleId: string
): Promise<RolePermission[]> {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("*")
    .eq("role_id", roleId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[rolePermissionRepository] getPermissionsByRole:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function assignPermission(
  item: RolePermissionForm
): Promise<RolePermission> {
  const { data, error } = await supabase
    .from("role_permissions")
    .insert(item)
    .select()
    .single();

  if (error) {
    console.error("[rolePermissionRepository] assignPermission:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function removePermission(
  roleId: string,
  permissionId: string
): Promise<void> {
  const { error } = await supabase
    .from("role_permissions")
    .delete()
    .eq("role_id", roleId)
    .eq("permission_id", permissionId);

  if (error) {
    console.error("[rolePermissionRepository] removePermission:", error);
    throw new Error(error.message);
  }
}

export async function replacePermissions(
  roleId: string,
  permissionIds: string[]
): Promise<void> {
  // Delete all existing mappings for this role
  const { error: deleteError } = await supabase
    .from("role_permissions")
    .delete()
    .eq("role_id", roleId);

  if (deleteError) {
    console.error("[rolePermissionRepository] replacePermissions (delete):", deleteError);
    throw new Error(deleteError.message);
  }

  if (permissionIds.length === 0) return;

  // Insert all new mappings
  const rows = permissionIds.map((permission_id) => ({
    role_id: roleId,
    permission_id,
  }));

  const { error: insertError } = await supabase
    .from("role_permissions")
    .insert(rows);

  if (insertError) {
    console.error("[rolePermissionRepository] replacePermissions (insert):", insertError);
    throw new Error(insertError.message);
  }
}
