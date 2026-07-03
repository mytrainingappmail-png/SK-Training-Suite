import type { Category } from "../../types/category";
import { getCategories } from "../../repositories/category/categoryRepository";

export async function loadCategories(): Promise<Category[]> {
  return await getCategories();
}
