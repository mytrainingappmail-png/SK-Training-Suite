import type { Module } from "../../types/module";
import type { ModuleForm } from "../../types/module";

import {
  getModules,
  createModule as repositoryCreateModule,
  updateModule,
  deleteModule,
  setModuleStatus,
} from "../../repositories/module/moduleRepository";

export async function loadModules(): Promise<Module[]> {
  return await getModules();
}

export async function createModule(data: ModuleForm): Promise<Module> {
  validateModuleForm(data);
  return await repositoryCreateModule(data);
}

export async function saveModule(
  id: string,
  data: Partial<ModuleForm>
): Promise<Module> {
  if (!id) throw new Error("Invalid Module ID.");
  validateModuleForm(data);
  return await updateModule(id, data);
}

export async function removeModule(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Module ID.");
  await deleteModule(id);
}

export async function toggleModuleStatus(
  id: string,
  active: boolean
): Promise<Module> {
  if (!id) throw new Error("Invalid Module ID.");
  return await setModuleStatus(id, active);
}

function validateModuleForm(data: Partial<ModuleForm>): void {
  if (!data.course_id) {
    throw new Error("Course is required.");
  }

  if (!data.module_code?.trim()) {
    throw new Error("Module Code is required.");
  }

  if (!data.module_name?.trim()) {
    throw new Error("Module Name is required.");
  }

  if (data.module_order !== undefined && data.module_order < 1) {
    throw new Error("Module Order must be at least 1.");
  }

  if (data.estimated_minutes !== undefined && data.estimated_minutes < 1) {
    throw new Error("Estimated Minutes must be at least 1.");
  }
}
