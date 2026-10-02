// supabase/functions/quiz-admin-reset-with-otp/index.ts
//
// Step 2 of the OTP password reset (step 1: quiz-admin-forgot-password
// emails the code). Takes the same identifier the user looked up their
// account with, plus the 6-digit code and their chosen new password.
// Re-resolves the internal auth email server-side (never trust a client-
// supplied email), verifies the OTP via Supabase's own
// auth.verifyOtp(type: 'recovery') — this is the SAME mechanism the
// magic-link flow uses under the hood, just fed the raw code instead of
// a URL — then sets the new password directly via the Admin API. No
// client-side session juggling needed.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clientIp, escapeLike, HttpError, rateLimit } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ResetRequest {
  identifier: string;
  otp: string;
  newPassword: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Required secrets are not configured.");
    }

    const payload: ResetRequest = await req.json();
    const identifier = (payload.identifier ?? "").trim();
    const otp = (payload.otp ?? "").trim();
    if (!identifier || !otp || !payload.newPassword) {
      throw new Error("identifier, otp and newPassword are all required.");
    }
    if (payload.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // A 6-digit code can be guessed by brute force, so cap wrong tries: 5 per
    // account per 15 minutes (whoever is guessing burns the account's budget)
    // and a wider ceiling per network address.
    await rateLimit(supabaseAdmin, `quiz-reset:ip:${clientIp(req)}`, 30, 900);
    await rateLimit(supabaseAdmin, `quiz-reset:id:${identifier.toLowerCase()}`, 5, 900, "Too many attempts. Request a new code and try again in a few minutes.");

    // Find the admin by the contact email or mobile they typed. Matching is
    // literal (no wildcards) and each lookup is its own query, so the typed
    // text can never alter the query itself.
    const byEmail = await supabaseAdmin
      .from("quiz_admins")
      .select("username, auth_user_id, contact_email, contact_mobile, status, companies(company_code)")
      .ilike("contact_email", escapeLike(identifier))
      .eq("status", "active")
      .limit(2);
    const byMobile = byEmail.data && byEmail.data.length > 0 ? { data: [] as typeof byEmail.data } : await supabaseAdmin
      .from("quiz_admins")
      .select("username, auth_user_id, contact_email, contact_mobile, status, companies(company_code)")
      .eq("contact_mobile", identifier)
      .eq("status", "active")
      .limit(2);
    const matches = [...(byEmail.data ?? []), ...(byMobile.data ?? [])];
    // Ambiguous (two accounts share the contact) is treated as no match.
    const admin = matches.length === 1 ? matches[0] : null;

    const companyCode = (admin?.companies as { company_code?: string } | null)?.company_code;
    if (!admin || !companyCode) {
      throw new Error("Invalid or expired code.");
    }

    // The account's real sign-in email — it keeps its original company code even after a rename.
    let internalEmail = `quiz.${companyCode.toLowerCase()}.${admin.username.toLowerCase()}@internal.sktraining`;
    if (admin.auth_user_id) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(admin.auth_user_id as string);
      if (authUser?.user?.email) internalEmail = authUser.user.email;
    }

    const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      email: internalEmail,
      token: otp,
      type: "recovery",
    });
    if (verifyError || !verifyData.user) {
      throw new Error("Invalid or expired code.");
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(verifyData.user.id, {
      password: payload.newPassword,
    });
    if (updateError) throw new Error(updateError.message);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: err instanceof HttpError ? err.status : 400 }
    );
  }
});
