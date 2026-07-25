import { supabaseQuiz } from "../../lib/supabaseQuiz";
import { setCurrentQuizAdmin, clearCurrentQuizAdmin } from "./quizAdminSession";
import { getAdminByAuthUserId } from "../../repositories/quiz/quizAdminRepository";
import type { QuizAdmin } from "../../types/quiz";

export interface QuizLoginCredentials {
  companyCode: string;
  username: string;
  password: string;
}

export type QuizLoginResult =
  | { success: true; admin: QuizAdmin; error: null }
  | { success: false; admin: null; error: string };

function internalEmailFor(companyCode: string, username: string): string {
  return `quiz.${companyCode.toLowerCase()}.${username.toLowerCase()}@internal.sktraining`;
}

interface CompanyLoginRow {
  id: string;
  active: boolean;
  live_quiz_enabled: boolean;
}

export async function login(credentials: QuizLoginCredentials): Promise<QuizLoginResult> {
  const { companyCode, username, password } = credentials;

  if (!companyCode.trim()) return fail("Company code is required.");
  if (!username.trim()) return fail("Username is required.");
  if (!password) return fail("Password is required.");

  const { data: companyRows, error: companyError } = await supabaseQuiz.rpc("get_company_for_quiz_login", {
    p_company_code: companyCode.trim(),
  });

  if (companyError) {
    console.error("[quizAuthService] get_company_for_quiz_login:", companyError.message);
    return fail("Invalid company code.");
  }

  const company = (companyRows as CompanyLoginRow[] | null)?.[0];
  if (!company) return fail("Invalid company code.");
  if (!company.active) return fail("This company account is inactive. Contact support.");
  if (!company.live_quiz_enabled) return fail("Live Quiz is not enabled for this company. Contact your administrator.");

  const { error: signInError } = await supabaseQuiz.auth.signInWithPassword({
    email: internalEmailFor(companyCode.trim(), username.trim()),
    password,
  });

  if (signInError) {
    console.error("[quizAuthService] signInWithPassword:", signInError.message);
    return fail("Invalid username or password.");
  }

  const { data: authData } = await supabaseQuiz.auth.getUser();
  const authUserId = authData.user?.id;
  if (!authUserId) return fail("Could not establish a session. Please try again.");

  const admin = await getAdminByAuthUserId(authUserId).catch(() => null);
  if (!admin) {
    await supabaseQuiz.auth.signOut();
    return fail("This account is not set up as a Live Quiz admin.");
  }
  if (admin.status !== "active") {
    await supabaseQuiz.auth.signOut();
    return fail("Your Live Quiz admin account has been disabled. Contact your administrator.");
  }

  setCurrentQuizAdmin(admin);
  return { success: true, admin, error: null };
}

export async function logout(): Promise<void> {
  await supabaseQuiz.auth.signOut();
  clearCurrentQuizAdmin();
}

function fail(error: string): QuizLoginResult {
  return { success: false, admin: null, error };
}
