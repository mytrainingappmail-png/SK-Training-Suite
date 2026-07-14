import { supabase } from "../../lib/supabase";
import type { Resource } from "../../types/resource";
import type { ResourceForm } from "../../types/resource";

export async function getResources(): Promise<Resource[]> {
  const { data, error } = await supabase
    .from("learning_resources")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[resourceRepository] getResources:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getResourceById(id: string): Promise<Resource> {
  const { data, error } = await supabase
    .from("learning_resources")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[resourceRepository] getResourceById:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createResource(
  resource: ResourceForm
): Promise<Resource> {
  const { data, error } = await supabase
    .from("learning_resources")
    .insert(resource)
    .select()
    .single();

  if (error) {
    console.error("[resourceRepository] createResource:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateResource(
  id: string,
  resource: Partial<ResourceForm>
): Promise<Resource> {
  const { data, error } = await supabase
    .from("learning_resources")
    .update(resource)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[resourceRepository] updateResource:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteResource(id: string): Promise<void> {
  const { error } = await supabase
    .from("learning_resources")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[resourceRepository] deleteResource:", error);
    throw new Error(error.message);
  }
}

export async function toggleResourceStatus(
  id: string,
  active: boolean
): Promise<Resource> {
  const { data, error } = await supabase
    .from("learning_resources")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[resourceRepository] toggleResourceStatus:", error);
    throw new Error(error.message);
  }

  return data;
}
