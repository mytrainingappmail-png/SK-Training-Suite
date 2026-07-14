import type { Category } from "../../types/category";
import type { CategoryForm } from "../../types/category";

import {
  getCategories,
  createCategory as repositoryCreateCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus as repositoryToggleCategoryStatus,
} from "../../repositories/category/categoryRepository";

export async function loadCategories(): Promise<Category[]> {
  return await getCategories();
}

export async function createCategory(data: CategoryForm): Promise<Category> {
  if (!data.company_id)            throw new Error("Company is required.");
  if (!data.category_name?.trim()) throw new Error("Category Name is required.");

  return await repositoryCreateCategory(data);
}

export async function saveCategory(
  id: string,
  data: Partial<CategoryForm>
): Promise<Category> {
  if (!id)                          throw new Error("Invalid Category ID.");
  if (!data.company_id)             throw new Error("Company is required.");
  if (!data.category_name?.trim())  throw new Error("Category Name is required.");

  return await updateCategory(id, data);
}

export async function removeCategory(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Category ID.");
  await deleteCategory(id);
}

export async function toggleCategoryStatus(
  id: string,
  active: boolean
): Promise<Category> {
  if (!id) throw new Error("Invalid Category ID.");
  return await repositoryToggleCategoryStatus(id, active);
}
