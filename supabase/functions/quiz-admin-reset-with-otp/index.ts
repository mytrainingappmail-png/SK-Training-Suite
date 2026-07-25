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

    const { data: admin } = await supabaseAdmin
      .from("quiz_admins")
      .select("username, contact_email, contact_mobile, status, companies(company_code)")
      .or(`contact_email.ilike.${identifier},contact_mobile.eq.${identifier}`)
      .eq("status", "active")
      .maybeSingle();

    const companyCode = (admin?.companies as { company_code?: string } | null)?.company_code;
    if (!admin || !companyCode) {
      throw new Error("Invalid or expired code.");
    }

    const internalEmail = `quiz.${companyCode.toLowerCase()}.${admin.username.toLowerCase()}@internal.sktraining`;

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
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
