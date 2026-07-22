// src/types/adminModuleCategory.ts
//
// Lets an Admin fully control how Admin Console tabs are grouped —
// create/rename/reorder categories, and assign any known module_id
// (e.g. "company", "branch") to whichever category they want, all
// through a real UI, with zero code changes needed to reorganize.
// Adding a brand-new FEATURE still needs code (a real component has
// to exist), but deciding WHICH BOX it lives in never does again.

export interface AdminModuleCategory {
  id: string;
  category_name: string;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type AdminModuleCategoryForm = Omit<AdminModuleCategory, 'id' | 'created_at' | 'updated_at'>;

export const defaultAdminModuleCategoryForm: AdminModuleCategoryForm = {
  category_name: '',
  display_order: 0,
  active: true,
};

export interface AdminModuleAssignment {
  id: string;
  module_id: string;
  category_id: string;
  display_order: number;
  custom_label: string | null;
  created_at: string;
  updated_at: string;
}

export type AdminModuleAssignmentForm = Omit<AdminModuleAssignment, 'id' | 'created_at' | 'updated_at'>;
