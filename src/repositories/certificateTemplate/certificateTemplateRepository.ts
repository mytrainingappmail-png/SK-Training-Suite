import { supabase } from "../../lib/supabase";
import type { CertificateTemplate } from "../../types/certificateTemplate";
import type { CertificateTemplateForm } from "../../types/certificateTemplate";

export async function getTemplates(): Promise<CertificateTemplate[]> {
  const { data, error } = await supabase
    .from("certificate_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[certificateTemplateRepository] getTemplates:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getTemplate(id: string): Promise<CertificateTemplate> {
  const { data, error } = await supabase
    .from("certificate_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[certificateTemplateRepository] getTemplate:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createTemplate(
  template: CertificateTemplateForm
): Promise<CertificateTemplate> {
  const { data, error } = await supabase
    .from("certificate_templates")
    .insert(template)
    .select()
    .single();

  if (error) {
    console.error("[certificateTemplateRepository] createTemplate:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateTemplate(
  id: string,
  template: Partial<CertificateTemplateForm>
): Promise<CertificateTemplate> {
  const { data, error } = await supabase
    .from("certificate_templates")
    .update(template)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[certificateTemplateRepository] updateTemplate:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("certificate_templates")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[certificateTemplateRepository] deleteTemplate:", error);
    throw new Error(error.message);
  }
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<CertificateTemplate> {
  const { data, error } = await supabase
    .from("certificate_templates")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[certificateTemplateRepository] toggleActive:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function setDefaultTemplate(
  id: string
): Promise<void> {
  // Clear existing default first, then set the new one
  const { error: clearError } = await supabase
    .from("certificate_templates")
    .update({ default_template: false })
    .neq("id", id);

  if (clearError) {
    console.error("[certificateTemplateRepository] setDefaultTemplate (clear):", clearError);
    throw new Error(clearError.message);
  }

  const { error: setError } = await supabase
    .from("certificate_templates")
    .update({ default_template: true })
    .eq("id", id);

  if (setError) {
    console.error("[certificateTemplateRepository] setDefaultTemplate (set):", setError);
    throw new Error(setError.message);
  }
}
