// src/services/adminModuleCategory/adminModuleCategoryService.ts
//
// Business logic — validation + orchestration.

import {
  getCategories,
  createCategory as repoCreateCategory,
  updateCategory,
  deleteCategory,
  getAssignments,
  getAssignmentForModule,
  upsertAssignment,
} from '../../repositories/adminModuleCategory/adminModuleCategoryRepository';
import type {
  AdminModuleCategory,
  AdminModuleCategoryForm,
  AdminModuleAssignment,
} from '../../types/adminModuleCategory';

export async function loadCategories(): Promise<AdminModuleCategory[]> {
  return getCategories();
}

export async function loadAssignments(): Promise<AdminModuleAssignment[]> {
  return getAssignments();
}

function validateCategoryForm(form: AdminModuleCategoryForm): void {
  if (!form.category_name.trim()) throw new Error('Category name is required.');
}

export async function createCategory(form: AdminModuleCategoryForm): Promise<AdminModuleCategory> {
  validateCategoryForm(form);
  return repoCreateCategory(form);
}

export async function saveCategory(id: string, form: Partial<AdminModuleCategoryForm>): Promise<AdminModuleCategory> {
  if (!id) throw new Error('Invalid category ID.');
  return updateCategory(id, form);
}

export async function removeCategory(id: string): Promise<void> {
  if (!id) throw new Error('Invalid category ID.');
  await deleteCategory(id);
}

export async function assignModuleToCategory(moduleId: string, categoryId: string, displayOrder = 0): Promise<void> {
  if (!moduleId) throw new Error('Module ID is required.');
  if (!categoryId) throw new Error('Category is required.');
  const existing = await getAssignmentForModule(moduleId);
  await upsertAssignment({
    module_id: moduleId,
    category_id: categoryId,
    display_order: displayOrder,
    custom_label: existing?.custom_label ?? null,
  });
}

/**
 * Renames a module's display label, without disturbing whatever
 * category it's currently assigned to (or leaving it unassigned).
 */
export async function renameModule(moduleId: string, customLabel: string, fallbackCategoryId: string): Promise<void> {
  if (!moduleId) throw new Error('Module ID is required.');
  const existing = await getAssignmentForModule(moduleId);
  await upsertAssignment({
    module_id: moduleId,
    category_id: existing?.category_id ?? fallbackCategoryId,
    display_order: existing?.display_order ?? 0,
    custom_label: customLabel.trim() || null,
  });
}

/**
 * Persists a new drag-and-drop order for every module in one category
 * in a single pass — each module's position in the given array becomes
 * its new display_order.
 */
export async function reorderModulesInCategory(orderedModuleIds: string[], categoryId: string): Promise<void> {
  for (let i = 0; i < orderedModuleIds.length; i++) {
    const moduleId = orderedModuleIds[i];
    const existing = await getAssignmentForModule(moduleId);
    await upsertAssignment({
      module_id: moduleId,
      category_id: existing?.category_id ?? categoryId,
      display_order: i,
      custom_label: existing?.custom_label ?? null,
    });
  }
}
