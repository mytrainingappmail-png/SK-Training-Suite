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
// re-verifies the caller's own JWT server-side and requires their
// employees row's company_id to match the company they're requesting.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ProvisionRequest {
  companyId: string;
  companyCode: string;
  username: string;
  displayName: string;
  password: string;
  role: "super_admin" | "admin";
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
    if (!payload.companyId || !payload.companyCode || !payload.username || !payload.password) {
      throw new Error("companyId, companyCode, username and password are all required.");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const callerJwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(callerJwt);
    if (callerError || !callerData.user) {
      throw new Error("You must be signed in to set up a Live Quiz admin.");
    }

    const { data: callerEmployee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select("company_id")
      .eq("auth_user_id", callerData.user.id)
      .maybeSingle();
    if (employeeError || !callerEmployee || callerEmployee.company_id !== payload.companyId) {
      throw new Error("You are not authorized to create a Live Quiz admin for this company.");
    }

    const internalEmail = `quiz.${payload.companyCode.toLowerCase()}.${payload.username.toLowerCase()}@internal.sktraining`;

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
      })
      .select()
      .single();

    if (insertError) {
      // Roll back the auth user so a failed insert never leaves an
      // orphaned, unusable login behind.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
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
