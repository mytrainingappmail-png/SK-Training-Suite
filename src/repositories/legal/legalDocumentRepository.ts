import { supabase } from "../../lib/supabase";
import type { LegalDocument } from "../../types/legalDocument";

export async function getAll(): Promise<LegalDocument[]> {
  const { data, error } = await supabase.from("legal_documents").select("*").order("title", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBySlug(slug: string): Promise<LegalDocument | null> {
  const { data, error } = await supabase.from("legal_documents").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function update(id: string, content_html: string): Promise<LegalDocument> {
  const { data, error } = await supabase
    .from("legal_documents")
    .update({ content_html, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
