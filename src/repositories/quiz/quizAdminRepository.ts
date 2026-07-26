import { supabaseQuiz } from "../../lib/supabaseQuiz";
import type { QuizAdmin } from "../../types/quiz";

export async function getAdminByAuthUserId(authUserId: string): Promise<QuizAdmin | null> {
  const { data, error } = await supabaseQuiz
    .from("quiz_admins")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    console.error("[quizAdminRepository] getAdminByAuthUserId:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function listAdmins(companyId: string): Promise<QuizAdmin[]> {
  const { data, error } = await supabaseQuiz
    .from("quiz_admins")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[quizAdminRepository] listAdmins:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export interface ProvisionAdminPayload {
  companyId: string;
  username: string;
  displayName: string;
  password: string;
  role: "super_admin" | "admin";
  permissionLevel?: "view_only" | "edit";
  contactEmail?: string;
  contactMobile?: string;
}

export interface ProvisionAdminResult {
  success: boolean;
  quizAdmin?: QuizAdmin;
  internalEmail?: string;
  error?: string;
}

/** Calls the provision-quiz-admin-auth edge function (needs the service role key, so it can't run client-side). */
export async function provisionAdmin(payload: ProvisionAdminPayload): Promise<ProvisionAdminResult> {
  const { data, error } = await supabaseQuiz.functions.invoke("provision-quiz-admin-auth", {
    body: payload,
  });

  if (error) {
    console.error("[quizAdminRepository] provisionAdmin:", error);
    return { success: false, error: error.message };
  }

  return data as ProvisionAdminResult;
}

export async function updateAdminStatus(id: string, status: "active" | "disabled"): Promise<void> {
  const { error } = await supabaseQuiz.from("quiz_admins").update({ status }).eq("id", id);

  if (error) {
    console.error("[quizAdminRepository] updateAdminStatus:", error);
    throw new Error(error.message);
  }
}

/** Role changes are blocked by RLS/the edge function's own rules where it matters (only a super_admin session can act here at all, per the Users page's UI gating) — this just persists the choice. */
export async function updateAdminPermissions(
  id: string,
  patch: { role?: "super_admin" | "admin"; permission_level?: "view_only" | "edit" }
): Promise<void> {
  const { error } = await supabaseQuiz.from("quiz_admins").update(patch).eq("id", id);

  if (error) {
    console.error("[quizAdminRepository] updateAdminPermissions:", error);
    throw new Error(error.message);
  }
}

export interface UpdateProfilePayload {
  display_name?: string;
  contact_email?: string;
  contact_mobile?: string;
}

export async function updateProfile(id: string, patch: UpdateProfilePayload): Promise<QuizAdmin> {
  const { data, error } = await supabaseQuiz.from("quiz_admins").update(patch).eq("id", id).select().single();

  if (error) {
    console.error("[quizAdminRepository] updateProfile:", error);
    throw new Error(error.message);
  }

  return data;
}
