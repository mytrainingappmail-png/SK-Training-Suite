import { supabaseCallingApp } from "../../lib/supabaseCallingApp";
import type { CallingAppAdmin } from "../../types/callingApp";

const SESSION_KEY = "CALLING_APP_ADMIN_SESSION";
let cache: CallingAppAdmin | null = null;

export function setCurrentCallingAppAdmin(admin: CallingAppAdmin): void {
  cache = admin;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(admin));
  } catch {
    console.warn("[callingAppAuthService] localStorage.setItem failed — session is memory-only.");
  }
}

export function getCurrentCallingAppAdmin(): CallingAppAdmin | null {
  return cache;
}

export function loadCurrentCallingAppAdmin(): CallingAppAdmin | null {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CallingAppAdmin;
    if (!parsed?.id) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    cache = parsed;
    return cache;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearCurrentCallingAppAdmin(): void {
  cache = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    console.warn("[callingAppAuthService] localStorage.removeItem failed.");
  }
}

export interface CallingAppLoginCredentials {
  username: string;
  password: string;
}

export type CallingAppLoginResult =
  | { success: true; admin: CallingAppAdmin; error: null }
  | { success: false; admin: null; error: string };

function internalEmailFor(companyCode: string, username: string): string {
  return `calling.${companyCode.toLowerCase()}.${username.toLowerCase()}@internal.sktraining`;
}

export async function login(credentials: CallingAppLoginCredentials): Promise<CallingAppLoginResult> {
  const { username, password } = credentials;
  if (!username.trim()) return fail("Username is required.");
  if (!password) return fail("Password is required.");

  const { data: infoRows, error: infoError } = await supabaseCallingApp.rpc("get_calling_app_admin_login_info", {
    p_username: username.trim(),
  });

  if (infoError) {
    console.error("[callingAppAuthService] get_calling_app_admin_login_info:", infoError.message);
    return fail("Invalid username or password.");
  }

  const info = (infoRows as { company_code: string; module_enabled: boolean }[] | null)?.[0];
  if (!info) return fail("Invalid username or password.");
  if (!info.module_enabled) return fail("Calling App is not enabled for this company. Contact your administrator.");

  const { error: signInError } = await supabaseCallingApp.auth.signInWithPassword({
    email: internalEmailFor(info.company_code, username.trim()),
    password,
  });

  if (signInError) {
    console.error("[callingAppAuthService] signInWithPassword:", signInError.message);
    return fail("Invalid username or password.");
  }

  const { data: authData } = await supabaseCallingApp.auth.getUser();
  const authUserId = authData.user?.id;
  if (!authUserId) return fail("Could not establish a session. Please try again.");

  const { data: admin, error: adminError } = await supabaseCallingApp
    .from("calling_app_admins")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (adminError || !admin) {
    await supabaseCallingApp.auth.signOut();
    return fail("This account is not set up for the Calling App.");
  }
  if (admin.status !== "active") {
    await supabaseCallingApp.auth.signOut();
    return fail("Your account has been disabled. Contact your administrator.");
  }

  setCurrentCallingAppAdmin(admin);
  return { success: true, admin, error: null };
}

export async function logout(): Promise<void> {
  await supabaseCallingApp.auth.signOut();
  clearCurrentCallingAppAdmin();
}

export interface ChangePasswordResult {
  success: boolean;
  error: string | null;
}

export async function changeOwnPassword(newPassword: string): Promise<ChangePasswordResult> {
  if (newPassword.length < 8) return { success: false, error: "Password must be at least 8 characters." };

  const { error } = await supabaseCallingApp.auth.updateUser({ password: newPassword });
  if (error) {
    console.error("[callingAppAuthService] changeOwnPassword:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true, error: null };
}

function fail(error: string): CallingAppLoginResult {
  return { success: false, admin: null, error };
}
