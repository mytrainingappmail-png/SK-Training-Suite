import { supabase } from "../../lib/supabase";
import type { EmailTemplate, EmailTemplateForm } from "../../types/emailTemplate";

export async function getTemplatesForCompany(companyId: string): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[emailTemplateRepository] getTemplatesForCompany:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createTemplate(
  companyId: string,
  createdBy: string | null,
  createdByName: string,
  form: EmailTemplateForm
): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from("email_templates")
    .insert({ ...form, company_id: companyId, created_by: createdBy, created_by_name: createdByName })
    .select()
    .single();

  if (error) {
    console.error("[emailTemplateRepository] createTemplate:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateTemplate(id: string, patch: Partial<EmailTemplateForm>): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from("email_templates")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[emailTemplateRepository] updateTemplate:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("email_templates").delete().eq("id", id);

  if (error) {
    console.error("[emailTemplateRepository] deleteTemplate:", error);
    throw new Error(error.message);
  }
}
