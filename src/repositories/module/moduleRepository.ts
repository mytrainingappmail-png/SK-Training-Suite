import { supabase } from "../../lib/supabase";
import type { Module } from "../../types/module";
import type { ModuleForm } from "../../types/module";

export async function getModules(): Promise<Module[]> {
  const { data, error } = await supabase
    .from("modules")
    .select("*")
    .order("module_order", { ascending: true });

  if (error) {
    console.error("[moduleRepository] getModules:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getModulesByCourse(courseId: string): Promise<Module[]> {
  const { data, error } = await supabase
    .from("modules")
    .select("*")
    .eq("course_id", courseId)
    .order("module_order", { ascending: true });

  if (error) {
    console.error("[moduleRepository] getModulesByCourse:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createModule(
  module: ModuleForm
): Promise<Module> {
  const { data, error } = await supabase
    .from("modules")
    .insert(module)
    .select()
    .single();

  if (error) {
    console.error("[moduleRepository] createModule:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateModule(
  id: string,
  module: Partial<ModuleForm>
): Promise<Module> {
  const { data, error } = await supabase
    .from("modules")
    .update(module)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[moduleRepository] updateModule:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteModule(id: string): Promise<void> {
  const { error } = await supabase
    .from("modules")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[moduleRepository] deleteModule:", error);
    throw new Error(error.message);
  }
}

export async function setModuleStatus(
  id: string,
  active: boolean
): Promise<Module> {
  const { data, error } = await supabase
    .from("modules")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[moduleRepository] setModuleStatus:", error);
    throw new Error(error.message);
  }

  return data;
}
