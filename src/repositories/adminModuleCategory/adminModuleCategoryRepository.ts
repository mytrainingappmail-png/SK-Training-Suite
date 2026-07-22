// src/repositories/adminModuleCategory/adminModuleCategoryRepository.ts
//
// Repository layer — Supabase ONLY.

import { supabase } from '../../lib/supabase';
import type {
  AdminModuleCategory,
  AdminModuleCategoryForm,
  AdminModuleAssignment,
  AdminModuleAssignmentForm,
} from '../../types/adminModuleCategory';

export async function getCategories(): Promise<AdminModuleCategory[]> {
  const { data, error } = await supabase
    .from('admin_module_categories')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCategory(form: AdminModuleCategoryForm): Promise<AdminModuleCategory> {
  const { data, error } = await supabase.from('admin_module_categories').insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCategory(id: string, form: Partial<AdminModuleCategoryForm>): Promise<AdminModuleCategory> {
  const { data, error } = await supabase.from('admin_module_categories').update(form).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('admin_module_categories').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getAssignments(): Promise<AdminModuleAssignment[]> {
  const { data, error } = await supabase
    .from('admin_module_assignments')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAssignmentForModule(moduleId: string): Promise<AdminModuleAssignment | null> {
  const { data, error } = await supabase
    .from('admin_module_assignments')
    .select('*')
    .eq('module_id', moduleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function upsertAssignment(form: AdminModuleAssignmentForm): Promise<AdminModuleAssignment> {
  const existing = await getAssignmentForModule(form.module_id);

  if (existing) {
    const { data, error } = await supabase
      .from('admin_module_assignments')
      .update({ ...form, custom_label: form.custom_label ?? existing.custom_label })
      .eq('id', existing.id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
    return { ...existing, ...form };
  }

  const { data, error } = await supabase.from('admin_module_assignments').insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  return { id: '', created_at: '', updated_at: '', ...form };
}
