import { supabase } from "../../lib/supabase";
import type { HelpArticle, HelpArticleForm } from "../../types/helpArticle";

// RLS returns published articles to everyone and drafts only to the
// platform operator, so a single query works for both audiences.
export async function getAllArticles(): Promise<HelpArticle[]> {
  const { data, error } = await supabase
    .from("help_articles")
    .select("*")
    .order("category", { ascending: true })
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[helpArticleRepository] getAllArticles:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createArticle(createdBy: string | null, createdByName: string, form: HelpArticleForm): Promise<HelpArticle> {
  const { data, error } = await supabase
    .from("help_articles")
    .insert({ ...form, created_by: createdBy, created_by_name: createdByName })
    .select()
    .single();

  if (error) {
    console.error("[helpArticleRepository] createArticle:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateArticle(id: string, patch: Partial<HelpArticleForm>): Promise<HelpArticle> {
  const { data, error } = await supabase
    .from("help_articles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[helpArticleRepository] updateArticle:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await supabase.from("help_articles").delete().eq("id", id);

  if (error) {
    console.error("[helpArticleRepository] deleteArticle:", error);
    throw new Error(error.message);
  }
}
