import { supabase } from "../../lib/supabase";
import type { Script } from "../../types/script";
import { getMyCompanyId } from "../../services/company/currentCompanyContext";

// Explicitly filtered by the caller's own company_id rather than relying
// on RLS alone — a platform operator can see every company's rows under
// RLS, which would otherwise mix every company's scripts together for
// that operator. Same convention as branchRepository.getBranches().
export async function getScripts(): Promise<Script[]> {
  const companyId = await getMyCompanyId();
  const { data, error } = await supabase
    .from("scripts")
    .select("*")
    .eq("company_id", companyId)
    .order("title", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createScript(script: Partial<Script>): Promise<Script> {
  const { data, error } = await supabase
    .from("scripts")
    .insert(script)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateScript(id: string, script: Partial<Script>): Promise<Script> {
  const { data, error } = await supabase
    .from("scripts")
    .update({ ...script, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteScript(id: string): Promise<void> {
  const { error } = await supabase.from("scripts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function toggleScriptStatus(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("scripts").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Used by the rich text editor to upload an image dropped inline into a
 * script — reuses the same real storage bucket as Projects/Induction's
 * own inline images, just a distinct folder so nothing collides. */
export async function uploadScriptInlineImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `images/scripts/inline-${Date.now()}-${Math.round(Math.random() * 10000)}.${ext}`;

  const { error } = await supabase.storage.from("course-content").upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("course-content").getPublicUrl(path);
  return data.publicUrl;
}
