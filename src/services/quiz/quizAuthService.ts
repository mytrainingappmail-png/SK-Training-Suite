import { supabaseQuiz } from "../../lib/supabaseQuiz";
import { setCurrentQuizAdmin, clearCurrentQuizAdmin } from "./quizAdminSession";
import { getAdminByAuthUserId } from "../../repositories/quiz/quizAdminRepository";
import type { QuizAdmin } from "../../types/quiz";

export interface QuizLoginCredentials {
  username: string;
  password: string;
}

export type QuizLoginResult =
  | { success: true; admin: QuizAdmin; error: null }
  | { success: false; admin: null; error: string };

function internalEmailFor(companyCode: string, username: string): string {
  return `quiz.${companyCode.toLowerCase()}.${username.toLowerCase()}@internal.sktraining`;
}

interface LoginInfoRow {
  company_code: string;
  live_quiz_enabled: boolean;
}

export async function login(credentials: QuizLoginCredentials): Promise<QuizLoginResult> {
  const { username, password } = credentials;

  if (!username.trim()) return fail("Username is required.");
  if (!password) return fail("Password is required.");

  // username is globally unique across quiz_admins, so the company is
  // resolved automatically — no Company Code field needed on this login.
  const { data: infoRows, error: infoError } = await supabaseQuiz.rpc("get_quiz_admin_login_info", {
    p_username: username.trim(),
  });

  if (infoError) {
    console.error("[quizAuthService] get_quiz_admin_login_info:", infoError.message);
    return fail("Invalid username or password.");
  }

  const info = (infoRows as LoginInfoRow[] | null)?.[0];
  if (!info) return fail("Invalid username or password.");
  if (!info.live_quiz_enabled) return fail("Live Quiz is not enabled for this company. Contact your administrator.");

  const { error: signInError } = await supabaseQuiz.auth.signInWithPassword({
    email: internalEmailFor(info.company_code, username.trim()),
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

export interface RequestPasswordResetResult {
  success: boolean;
  message: string;
}

/**
 * Step 1 of 2. Always returns a generic success message (whether or not
 * the identifier matched an account) — standard anti-enumeration
 * practice. Emails a 6-digit code (not a link) to the matched account's
 * contact email.
 */
export async function requestPasswordReset(identifier: string): Promise<RequestPasswordResetResult> {
  if (!identifier.trim()) {
    return { success: false, message: "Enter your registered email or mobile number." };
  }

  const { data, error } = await supabaseQuiz.functions.invoke("quiz-admin-forgot-password", {
    body: { identifier: identifier.trim() },
  });

  if (error) {
    console.error("[quizAuthService] requestPasswordReset:", error.message);
    return { success: false, message: "Something went wrong. Please try again in a moment." };
  }

  return { success: true, message: data?.message ?? "If an account matches, a code has been sent." };
}

export interface ResetWithOtpResult {
  success: boolean;
  error: string | null;
}

/** Step 2 of 2 — the code the user received plus their chosen new password. */
export async function resetPasswordWithOtp(
  identifier: string,
  otp: string,
  newPassword: string
): Promise<ResetWithOtpResult> {
  if (newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const { data, error } = await supabaseQuiz.functions.invoke("quiz-admin-reset-with-otp", {
    body: { identifier: identifier.trim(), otp: otp.trim(), newPassword },
  });

  if (error) {
    console.error("[quizAuthService] resetPasswordWithOtp:", error.message);
    return { success: false, error: "Something went wrong. Please try again." };
  }
  if (!data?.success) {
    return { success: false, error: data?.error ?? "That code is invalid or has expired." };
  }

  return { success: true, error: null };
}

export interface ChangePasswordResult {
  success: boolean;
  error: string | null;
}

/** Self-service password change while already logged in — no code needed. */
export async function changeOwnPassword(newPassword: string): Promise<ChangePasswordResult> {
  if (newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const { error } = await supabaseQuiz.auth.updateUser({ password: newPassword });
  if (error) {
    console.error("[quizAuthService] changeOwnPassword:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

function fail(error: string): QuizLoginResult {
  return { success: false, admin: null, error };
}
