import { supabase } from "../../lib/supabase";
import type { Permission } from "../../types/permission";
import type { PermissionForm } from "../../types/permission";

export async function getPermissions(): Promise<Permission[]> {
  const { data, error } = await supabase
    .from("permissions")
    .select("*")
    .order("module_name",     { ascending: true })
    .order("permission_code", { ascending: true });

  if (error) {
    console.error("[permissionRepository] getPermissions:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getPermission(id: string): Promise<Permission> {
  const { data, error } = await supabase
    .from("permissions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[permissionRepository] getPermission:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createPermission(
  permission: PermissionForm
): Promise<Permission> {
  const { data, error } = await supabase
    .from("permissions")
    .insert(permission)
    .select()
    .single();

  if (error) {
    console.error("[permissionRepository] createPermission:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updatePermission(
  id: string,
  permission: Partial<PermissionForm>
): Promise<Permission> {
  const { data, error } = await supabase
    .from("permissions")
    .update(permission)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[permissionRepository] updatePermission:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deletePermission(id: string): Promise<void> {
  const { error } = await supabase
    .from("permissions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[permissionRepository] deletePermission:", error);
    throw new Error(error.message);
  }
}
