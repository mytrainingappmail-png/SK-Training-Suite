import { supabase } from "../../lib/supabase";
import type { Role } from "../../types/role";
import type { RoleForm } from "../../types/role";

export async function getRoles(): Promise<Role[]> {
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .order("hierarchy_level", { ascending: true });

  if (error) {
    console.error("[roleRepository] getRoles:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getRole(id: string): Promise<Role> {
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[roleRepository] getRole:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createRole(role: RoleForm): Promise<Role> {
  const { data, error } = await supabase
    .from("roles")
    .insert(role)
    .select()
    .single();

  if (error) {
    console.error("[roleRepository] createRole:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateRole(
  id: string,
  role: Partial<RoleForm>
): Promise<Role> {
  const { data, error } = await supabase
    .from("roles")
    .update(role)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[roleRepository] updateRole:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteRole(id: string): Promise<void> {
  const { error } = await supabase
    .from("roles")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[roleRepository] deleteRole:", error);
    throw new Error(error.message);
  }
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<Role> {
  const { data, error } = await supabase
    .from("roles")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[roleRepository] toggleActive:", error);
    throw new Error(error.message);
  }

  return data;
}
