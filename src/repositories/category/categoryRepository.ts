import { supabase } from "../../lib/supabase";
import type { Category } from "../../types/category";

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("category_name", { ascending: true });

  if (error) {
    console.error("[categoryRepository] getCategories:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}
