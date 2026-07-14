import { supabase } from "../../lib/supabase";
import type { Category } from "../../types/category";
import type { CategoryForm } from "../../types/category";

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("course_categories")
    .select("*")
    .order("category_name", { ascending: true });

  if (error) {
    console.error("[categoryRepository] getCategories:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getCategoryById(id: string): Promise<Category> {
  const { data, error } = await supabase
    .from("course_categories")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[categoryRepository] getCategoryById:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createCategory(
  category: CategoryForm
): Promise<Category> {
  const { data, error } = await supabase
    .from("course_categories")
    .insert(category)
    .select()
    .single();

  if (error) {
    console.error("[categoryRepository] createCategory:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateCategory(
  id: string,
  category: Partial<CategoryForm>
): Promise<Category> {
  const { data, error } = await supabase
    .from("course_categories")
    .update(category)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[categoryRepository] updateCategory:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from("course_categories")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[categoryRepository] deleteCategory:", error);
    throw new Error(error.message);
  }
}

export async function toggleCategoryStatus(
  id: string,
  active: boolean
): Promise<Category> {
  const { data, error } = await supabase
    .from("course_categories")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[categoryRepository] toggleCategoryStatus:", error);
    throw new Error(error.message);
  }

  return data;
}
