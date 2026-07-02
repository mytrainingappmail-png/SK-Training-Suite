import { supabase } from "../../lib/supabase";
import type { Designation } from "../../types/designation";

export async function getDesignations(): Promise<Designation[]> {
  const { data, error } = await supabase
    .from("designations")
    .select("*")
    .order("designation_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function searchDesignations(
  keyword: string
): Promise<Designation[]> {
  const { data, error } = await supabase
    .from("designations")
    .select("*")
    .or(
      `designation_name.ilike.%${keyword}%,designation_code.ilike.%${keyword}%,description.ilike.%${keyword}%`
    )
    .order("designation_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createDesignation(
  designation: Partial<Designation>
): Promise<Designation> {
  const { data, error } = await supabase
    .from("designations")
    .insert(designation)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateDesignation(
  id: string,
  designation: Partial<Designation>
): Promise<Designation> {
  const { data, error } = await supabase
    .from("designations")
    .update(designation)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteDesignation(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("designations")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function toggleDesignationStatus(
  id: string,
  active: boolean
): Promise<void> {
  const { error } = await supabase
    .from("designations")
    .update({
      active,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

// FILE COMPLETE
