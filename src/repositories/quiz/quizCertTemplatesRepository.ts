import { supabaseQuiz } from "../../lib/supabaseQuiz";
import type { CertTemplateDraft, CertTemplateDraftForm } from "../../types/quiz";

export async function listCertTemplateDrafts(companyId: string): Promise<CertTemplateDraft[]> {
  const { data, error } = await supabaseQuiz
    .from("quiz_cert_templates")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[quizCertTemplatesRepository] listCertTemplateDrafts:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

/** New drafts start from a blank design by default — pass `copyFrom` to start from an existing draft's fields instead (the common case: "make a variant of what I already have"). */
export async function createCertTemplateDraft(companyId: string, name: string, copyFrom?: CertTemplateDraft): Promise<CertTemplateDraft> {
  const base: Partial<CertTemplateDraftForm> = copyFrom
    ? {
        template: copyFrom.template,
        company_name: copyFrom.company_name,
        company_name_align: copyFrom.company_name_align,
        logo_url: copyFrom.logo_url,
        logo_position: copyFrom.logo_position,
        logo_scale: copyFrom.logo_scale,
        watermark_type: copyFrom.watermark_type,
        watermark_text: copyFrom.watermark_text,
        title: copyFrom.title,
        achievement_line: copyFrom.achievement_line,
        signatory1_name: copyFrom.signatory1_name,
        signatory1_title: copyFrom.signatory1_title,
        signatory1_image_url: copyFrom.signatory1_image_url,
        signatory1_scale: copyFrom.signatory1_scale,
        signatory1_name_scale: copyFrom.signatory1_name_scale,
        signatory2_name: copyFrom.signatory2_name,
        signatory2_title: copyFrom.signatory2_title,
        signatory2_image_url: copyFrom.signatory2_image_url,
        signatory2_scale: copyFrom.signatory2_scale,
        signatory2_name_scale: copyFrom.signatory2_name_scale,
        signature_mode: copyFrom.signature_mode,
        signature_align: copyFrom.signature_align,
        photo_enabled: copyFrom.photo_enabled,
        photo_frame: copyFrom.photo_frame,
      }
    : {};

  const { data, error } = await supabaseQuiz
    .from("quiz_cert_templates")
    .insert({ company_id: companyId, name, is_active: false, ...base })
    .select()
    .single();

  if (error) {
    console.error("[quizCertTemplatesRepository] createCertTemplateDraft:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function updateCertTemplateDraft(id: string, patch: Partial<CertTemplateDraftForm>): Promise<CertTemplateDraft> {
  const { data, error } = await supabaseQuiz
    .from("quiz_cert_templates")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[quizCertTemplatesRepository] updateCertTemplateDraft:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function deleteCertTemplateDraft(id: string): Promise<void> {
  const { error } = await supabaseQuiz.from("quiz_cert_templates").delete().eq("id", id);
  if (error) {
    console.error("[quizCertTemplatesRepository] deleteCertTemplateDraft:", error);
    throw new Error(error.message);
  }
}

/** Atomically makes this the one active design for the company — the
 * server-side function clears the old active flag first so the
 * one-active-per-company database constraint is never violated mid-toggle. */
export async function setActiveCertTemplateDraft(id: string): Promise<void> {
  const { error } = await supabaseQuiz.rpc("set_active_quiz_cert_template", { p_template_id: id });
  if (error) {
    console.error("[quizCertTemplatesRepository] setActiveCertTemplateDraft:", error);
    throw new Error(error.message);
  }
}
