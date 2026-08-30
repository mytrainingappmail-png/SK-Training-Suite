// supabase/functions/provision-calling-app-admin-auth/index.ts
//
// Creates a REAL Supabase Auth account for one Calling App user
// ("calling.{companycode}.{username}@internal.sktraining") and links it
// to a calling_app_admins row via auth_user_id — the "dedicated login"
// mode. Mirrors provision-quiz-admin-auth exactly, but only an LMS
// employee may call this (never a Calling App session itself), matching
// calling_app_admins_write_employee RLS: granting/revoking access is a
// security boundary only a real LMS employee session can cross.
//
// If employeeId is also given and that employee already has a grant-only
// row (Case A: "use existing LMS login", no auth_user_id yet), this
// UPGRADES that same row in place instead of inserting a second one —
// unique(company_id, employee_id) would otherwise reject a duplicate.
//
// Needs the SERVICE ROLE key — must run as an Edge Function.

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
  email?: string;
  employeeId?: string;
  isAdmin?: boolean;
  canUpload?: boolean;
  canDownload?: boolean;
  dailyTarget?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Required secrets are not configured.");

    const payload: ProvisionRequest = await req.json();
    if (!payload.companyId || !payload.username || !payload.password) {
      throw new Error("companyId, username and password are all required.");
    }
    if (payload.password.length < 8) throw new Error("Password must be at least 8 characters.");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Only an already-signed-in LMS employee of this exact company may
    // call this — re-verified server-side, never trusted from the client.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerJwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(callerJwt);
    if (callerError || !callerData.user) {
      throw new Error("You must be signed in to set up a Calling App account.");
    }

    const { data: callerEmployee } = await supabaseAdmin
      .from("employees")
      .select("company_id")
      .eq("auth_user_id", callerData.user.id)
      .maybeSingle();

    if (!callerEmployee || callerEmployee.company_id !== payload.companyId) {
      throw new Error("You are not authorized to create a Calling App account for this company.");
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("company_code")
      .eq("id", payload.companyId)
      .maybeSingle();
    if (companyError || !company) throw new Error("Could not resolve the company.");

    const internalEmail = `calling.${company.company_code.toLowerCase()}.${payload.username.toLowerCase()}@internal.sktraining`;

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: payload.password,
      email_confirm: true,
    });
    if (createError) throw new Error(createError.message);

    const authFields = {
      auth_user_id: created.user.id,
      username: payload.username.toLowerCase(),
      display_name: payload.displayName || payload.username,
      email: payload.email || null,
    };

    let adminRow;
    let upsertError;

    if (payload.employeeId) {
      const { data: existing } = await supabaseAdmin
        .from("calling_app_admins")
        .select("id")
        .eq("company_id", payload.companyId)
        .eq("employee_id", payload.employeeId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabaseAdmin
          .from("calling_app_admins")
          .update(authFields)
          .eq("id", existing.id)
          .select()
          .single();
        adminRow = data;
        upsertError = error;
      }
    }

    if (!adminRow && !upsertError) {
      const { data, error } = await supabaseAdmin
        .from("calling_app_admins")
        .insert({
          company_id: payload.companyId,
          employee_id: payload.employeeId || null,
          is_admin: payload.isAdmin ?? false,
          can_upload: payload.canUpload ?? true,
          can_download: payload.canDownload ?? true,
          daily_target: payload.dailyTarget ?? 0,
          ...authFields,
        })
        .select()
        .single();
      adminRow = data;
      upsertError = error;
    }

    if (upsertError || !adminRow) {
      // Roll back the auth user so a failed insert/update never leaves an
      // orphaned, unusable login behind.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      if (upsertError?.code === "23505") {
        throw new Error("That username is already taken. Please choose a different one.");
      }
      throw new Error(upsertError?.message || "Could not create the Calling App account.");
    }

    return new Response(
      JSON.stringify({ success: true, admin: adminRow, internalEmail }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
