// supabase/functions/quiz-admin-forgot-password/index.ts
//
// Public (pre-session) "forgot password" for Live Quiz admins. The
// account's real Supabase Auth email is a synthetic internal one
// (quiz.{code}.{username}@internal.sktraining) — not deliverable — so
// this looks the admin up by their REAL contact email/mobile on file
// (quiz_admins.contact_email / contact_mobile), generates a genuine
// Supabase password-recovery link for their internal auth account via
// the Admin API, and emails that link to their real contact_email using
// the same Resend setup as the existing send-email function.
//
// Always responds with the same generic message regardless of whether a
// match was found — standard practice so this endpoint can't be used to
// find out which emails/mobiles have an account.
//
// Mobile-only accounts (no contact_email on file) can be identified but
// not actually sent anything — there is no SMS provider wired into this
// app. That's a known, honest limitation, not a bug.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GENERIC_MESSAGE = "If a Live Quiz admin account matches that email or mobile number, a reset link has been sent to its registered email address.";

interface ForgotPasswordRequest {
  identifier: string; // email or mobile, whichever the user typed
  redirectTo: string; // e.g. `${window.location.origin}/quiz-admin/reset-password`
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Required secrets are not configured.");
    }

    const payload: ForgotPasswordRequest = await req.json();
    const identifier = (payload.identifier ?? "").trim();
    if (!identifier || !payload.redirectTo) {
      throw new Error("identifier and redirectTo are required.");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: admin } = await supabaseAdmin
      .from("quiz_admins")
      .select("username, contact_email, contact_mobile, status, companies(company_code)")
      .or(`contact_email.ilike.${identifier},contact_mobile.eq.${identifier}`)
      .eq("status", "active")
      .maybeSingle();

    // Same response either way — don't reveal whether a match exists.
    const companyCode = (admin?.companies as { company_code?: string } | null)?.company_code;
    if (!admin || !admin.contact_email || !companyCode) {
      return new Response(JSON.stringify({ success: true, message: GENERIC_MESSAGE }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const internalEmail = `quiz.${companyCode.toLowerCase()}.${admin.username.toLowerCase()}@internal.sktraining`;

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: internalEmail,
      options: { redirectTo: payload.redirectTo },
    });
    if (linkError) throw new Error(linkError.message);

    if (resendApiKey && resendFromEmail) {
      const actionLink = linkData.properties?.action_link;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: resendFromEmail,
          to: admin.contact_email,
          subject: "Reset your Live Quiz admin password",
          html: `<p>Someone requested a password reset for the Live Quiz admin account <b>${admin.username}</b>.</p><p><a href="${actionLink}">Click here to set a new password</a>. This link expires soon and can only be used once.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true, message: GENERIC_MESSAGE }), {
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
