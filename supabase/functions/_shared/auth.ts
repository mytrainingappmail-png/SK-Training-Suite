// Shared caller-authentication helpers for edge functions that run with the
// service role. Those functions can do anything to any tenant, so they must
// first prove WHO is calling and that the caller may act on the target.
//
// The Supabase "verify_jwt" gate is not enough on its own: the public anon key
// is itself a valid JWT, so anybody on the internet passes it. Here we resolve
// the bearer token to a real signed-in user (the anon key has no user) and
// then to their employee row + role.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new HttpError(500, "Required secrets are not configured.");
  return createClient(url, key);
}

export interface Caller {
  authUserId: string;
  employeeId: string;
  companyId: string;
  isSuperAdmin: boolean;
  companyIsOperator: boolean;
}

/** Resolves the request's bearer token to an employee. Throws 401 if the token
 *  is missing, is just the anon key, or does not belong to an employee. */
export async function requireEmployeeCaller(req: Request, admin: SupabaseClient): Promise<Caller> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "Sign in to continue.");

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) throw new HttpError(401, "Your session is not valid. Please sign in again.");

  const authUserId = userData.user.id;

  const { data: emp, error: empError } = await admin
    .from("employees")
    .select("id, company_id, active, companies(is_platform_operator)")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (empError) throw new HttpError(500, "Could not verify your account.");
  if (!emp || emp.active === false) throw new HttpError(403, "This action is only available to company administrators.");

  const { data: roleRows, error: roleError } = await admin
    .from("employee_roles")
    .select("active, roles!inner(role_code, company_id)")
    .eq("employee_id", emp.id)
    .eq("active", true);
  if (roleError) throw new HttpError(500, "Could not verify your role.");

  const isSuperAdmin = (roleRows ?? []).some((row: Record<string, unknown>) => {
    const role = row.roles as { role_code?: string; company_id?: string } | { role_code?: string; company_id?: string }[] | null;
    const r = Array.isArray(role) ? role[0] : role;
    return r?.role_code === "SUPER_ADMIN" && r?.company_id === emp.company_id;
  });

  const companies = emp.companies as { is_platform_operator?: boolean } | { is_platform_operator?: boolean }[] | null;
  const company = Array.isArray(companies) ? companies[0] : companies;

  return {
    authUserId,
    employeeId: emp.id as string,
    companyId: emp.company_id as string,
    isSuperAdmin,
    companyIsOperator: company?.is_platform_operator === true,
  };
}

/** A company administrator may manage their own company's employees; the
 *  platform operator's administrators may manage any company's. */
export function assertCanAdminister(caller: Caller, targetCompanyId: string): void {
  if (!caller.isSuperAdmin) throw new HttpError(403, "Only a company administrator can do this.");
  if (caller.companyId !== targetCompanyId && !caller.companyIsOperator) {
    throw new HttpError(403, "You can only manage employees of your own company.");
  }
}

/** True when the bearer token is the project's service-role key (the pg_cron
 *  scheduler uses it). The gateway has already verified the JWT signature
 *  (verify_jwt), so reading the role claim from the payload is sufficient. */
export function isServiceRoleRequest(req: Request): boolean {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
    return claims?.role === "service_role";
  } catch {
    return false;
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return (fwd.split(",")[0] || req.headers.get("cf-connecting-ip") || "unknown").trim();
}

/** Counts a hit against `key`; throws 429 once more than `max` hits land
 *  within `windowSeconds`. Backed by the edge_rate_limits table. */
export async function rateLimit(
  admin: SupabaseClient,
  key: string,
  max: number,
  windowSeconds: number,
  message = "Too many requests. Please wait a while and try again.",
): Promise<void> {
  const { data, error } = await admin.rpc("edge_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new HttpError(500, "Could not check request limits.");
  if (data === false) throw new HttpError(429, message);
}

/** Escapes % and _ so user text can be used as a literal in ILIKE. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => "\\" + c);
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
