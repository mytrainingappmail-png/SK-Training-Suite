// supabase/functions/provision-quiz-admin-auth/index.ts
//
// Creates a REAL Supabase Auth account for one Live Quiz admin and links
// it back to their quiz_admins row via auth_user_id, then inserts the
// quiz_admins row itself. Mirrors provision-employee-auth exactly, but
// for a completely separate identity pool ("quiz.{companycode}.{username}
// @internal.sktraining") so quiz admins are never LMS employees.
//
// Needs the SERVICE ROLE key — must run as an Edge Function, never in the
// browser. Also required because a brand-new company's first quiz admin
// can't satisfy quiz_admins' own RLS policy yet (no row exists for
// current_quiz_admin_company_id() to find) — the service role bypasses
// RLS entirely for this one bootstrap insert.
//
// The Functions gateway only checks that the caller's Authorization
// header is A valid Supabase JWT, not that it belongs to companyId —
// without the check below, any logged-in LMS employee could pass a
// DIFFERENT company's id/code and provision a quiz admin for it. So this
// re-verifies the caller's own JWT server-side, accepting EITHER an LMS
// employee (the in-LMS bootstrap panel, for a company's first admin) OR
// an already-active quiz_admin (the standalone app's own Users page,
// once at least one admin exists) — either way their own company_id
// must match the one they're requesting.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ProvisionRequest {
  companyId: string;
  username: string;
  displayName: string;
  password: string;
  role: "super_admin" | "admin";
  permissionLevel?: "view_only" | "edit";
  contactEmail?: string;
  contactMobile?: string;
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

    const payload: ProvisionRequest = await req.json();
    if (!payload.companyId || !payload.username || !payload.password) {
      throw new Error("companyId, username and password are all required.");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const callerJwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(callerJwt);
    if (callerError || !callerData.user) {
      throw new Error("You must be signed in to set up a Live Quiz admin.");
    }

    const { data: callerEmployee } = await supabaseAdmin
      .from("employees")
      .select("company_id")
      .eq("auth_user_id", callerData.user.id)
      .maybeSingle();

    const { data: callerQuizAdmin } = await supabaseAdmin
      .from("quiz_admins")
      .select("company_id, status, role")
      .eq("auth_user_id", callerData.user.id)
      .maybeSingle();

    const authorizedAsEmployee = callerEmployee?.company_id === payload.companyId;
    const authorizedAsQuizAdmin = callerQuizAdmin?.status === "active" && callerQuizAdmin.company_id === payload.companyId;

    if (!authorizedAsEmployee && !authorizedAsQuizAdmin) {
      throw new Error("You are not authorized to create a Live Quiz admin for this company.");
    }

    // Only a super_admin (or the LMS bootstrap panel, which only ever
    // requests super_admin for a company's very first account) may grant
    // super_admin — otherwise any active "admin" could call this function
    // directly and escalate themselves or a new user to full user-
    // management rights, bypassing the Users page's own UI gating.
    const requestingSuperAdmin = (payload.role ?? "admin") === "super_admin";
    if (requestingSuperAdmin && authorizedAsQuizAdmin && !authorizedAsEmployee && callerQuizAdmin?.role !== "super_admin") {
      throw new Error("Only a Super Admin can grant Super Admin access.");
    }

    // Resolved server-side, never trusted from the client — the internal
    // email's company segment must match the ALREADY-VERIFIED companyId.
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("company_code")
      .eq("id", payload.companyId)
      .maybeSingle();
    if (companyError || !company) throw new Error("Could not resolve the company.");

    const internalEmail = `quiz.${company.company_code.toLowerCase()}.${payload.username.toLowerCase()}@internal.sktraining`;

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: payload.password,
      email_confirm: true,
    });
    if (createError) throw new Error(createError.message);

    const { data: adminRow, error: insertError } = await supabaseAdmin
      .from("quiz_admins")
      .insert({
        company_id: payload.companyId,
        auth_user_id: created.user.id,
        username: payload.username.toLowerCase(),
        display_name: payload.displayName || payload.username,
        role: payload.role || "admin",
        permission_level: payload.permissionLevel || "edit",
        contact_email: payload.contactEmail || null,
        contact_mobile: payload.contactMobile || null,
      })
      .select()
      .single();

    if (insertError) {
      // Roll back the auth user so a failed insert never leaves an
      // orphaned, unusable login behind.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      // username is unique GLOBALLY now (the login screen only asks for
      // username + password, no company code) — surface the common case
      // in plain language instead of a raw Postgres constraint error.
      if (insertError.code === "23505") {
        throw new Error("That username is already taken. Please choose a different one.");
      }
      throw new Error(insertError.message);
    }

    return new Response(
      JSON.stringify({ success: true, quizAdmin: adminRow, internalEmail }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
