// supabase/functions/quiz-admin-forgot-password/index.ts
//
// Public (pre-session) "forgot password" for Live Quiz admins, step 1 of
// 2 (step 2 is quiz-admin-reset-with-otp). The account's real Supabase
// Auth email is a synthetic internal one
// (quiz.{code}.{username}@internal.sktraining) — not deliverable — so
// this looks the admin up by their REAL contact email/mobile on file
// (quiz_admins.contact_email / contact_mobile), asks Supabase's Admin API
// for a recovery link for that internal account, and pulls the plain
// 6-digit OTP Supabase generates alongside it (`properties.email_otp`)
// — the SAME code the link itself would have redeemed — then emails just
// that code (not the link) via the existing Resend setup. A true SMS OTP
// isn't possible here: no SMS provider is wired into this app.
//
// Always responds with the same generic message regardless of whether a
// match was found — standard practice so this endpoint can't be used to
// find out which emails/mobiles have an account.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clientIp, escapeLike, HttpError, rateLimit } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GENERIC_MESSAGE = "If a Live Quiz admin account matches that email or mobile number, a 6-digit code has been sent to its registered email address.";

interface ForgotPasswordRequest {
  identifier: string; // email or mobile, whichever the user typed
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
    if (!identifier) throw new Error("identifier is required.");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Throttle code requests: per network address and per typed identifier,
    // so nobody can flood an admin's inbox or burn through codes.
    await rateLimit(supabaseAdmin, `quiz-forgot:ip:${clientIp(req)}`, 20, 3600);
    await rateLimit(supabaseAdmin, `quiz-forgot:id:${identifier.toLowerCase()}`, 3, 3600, "A code was already sent recently. Please check your email or try again in an hour.");

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

    // Same response either way — don't reveal whether a match exists.
    const companyCode = (admin?.companies as { company_code?: string } | null)?.company_code;
    if (!admin || !admin.contact_email || !companyCode) {
      return new Response(JSON.stringify({ success: true, message: GENERIC_MESSAGE }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // The account's real sign-in email — it keeps its original company code even after a rename.
    let internalEmail = `quiz.${companyCode.toLowerCase()}.${admin.username.toLowerCase()}@internal.sktraining`;
    if (admin.auth_user_id) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(admin.auth_user_id as string);
      if (authUser?.user?.email) internalEmail = authUser.user.email;
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: internalEmail,
    });
    if (linkError) throw new Error(linkError.message);

    const otp = linkData.properties?.email_otp;

    if (otp && resendApiKey && resendFromEmail) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: resendFromEmail,
          to: admin.contact_email,
          subject: "Your Live Quiz password reset code",
          html: `<p>Someone requested a password reset for the Live Quiz admin account <b>${admin.username}</b>.</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;">${otp}</p><p>Enter this code on the reset page. It expires shortly and can only be used once.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
        }),
      });
      // The client always gets the same generic message (anti-enumeration),
      // so a silent Resend failure here — sandbox mode, unverified sending
      // domain, bad address — used to look identical to a real send from
      // the outside. Logging it server-side is the only way to tell the
      // difference when someone reports "no code arrived".
      if (!resendRes.ok) {
        const body = await resendRes.text().catch(() => "");
        console.error(`[quiz-admin-forgot-password] Resend send failed (${resendRes.status}): ${body}`);
      }
    } else if (otp) {
      console.error("[quiz-admin-forgot-password] RESEND_API_KEY/RESEND_FROM_EMAIL not configured — OTP generated but no email was sent.");
    }

    return new Response(JSON.stringify({ success: true, message: GENERIC_MESSAGE }), {
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
