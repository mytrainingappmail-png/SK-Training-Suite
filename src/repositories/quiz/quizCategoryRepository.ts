import { supabaseQuiz } from "../../lib/supabaseQuiz";
import type { QuizCategory } from "../../types/quiz";

export async function listCategories(companyId: string): Promise<QuizCategory[]> {
  const { data, error } = await supabaseQuiz
    .from("quiz_categories")
    .select("*")
    .eq("company_id", companyId)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[quizCategoryRepository] listCategories:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createCategory(companyId: string, name: string): Promise<QuizCategory> {
  const { data, error } = await supabaseQuiz
    .from("quiz_categories")
    .insert({ company_id: companyId, name })
    .select()
    .single();

  if (error) {
    console.error("[quizCategoryRepository] createCategory:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabaseQuiz.from("quiz_categories").delete().eq("id", id);

  if (error) {
    console.error("[quizCategoryRepository] deleteCategory:", error);
    throw new Error(error.message);
  }
}
