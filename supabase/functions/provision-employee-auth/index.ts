// supabase/functions/provision-employee-auth/index.ts
//
// Phase 1 of the login security migration. Creates a REAL Supabase Auth
// account for one employee and links it back to their employees row via
// auth_user_id. Uses a "fake" internal email pattern
// ({companyCode}.{employeeId}@internal.sktraining) so the EXISTING
// login screen (Company Code + Employee ID + Password) never has to
// change — this is purely internal plumbing.
//
// This function requires the SERVICE ROLE key (admin-level access),
// which is why it must run as an Edge Function — never in the browser.
//
// SETUP REQUIRED:
// 1. Deploy:  supabase functions deploy provision-employee-auth
// 2. Set secrets:
//      supabase secrets set SUPABASE_URL=https://yourproject.supabase.co
//      supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
//    (Find the Service Role key in Supabase Dashboard -> Settings -> API
//    -> it's the OTHER key, never the anon key. Never put this key in
//    any React file.)

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ProvisionRequest {
  employeeDbId: string;
  companyCode: string;
  employeeCode: string;
  password: string;
}

serve(async (req) => {
  // Browsers send a CORS preflight OPTIONS request before the real
  // POST — without answering this, the browser blocks the real
  // request entirely before it's even sent. Direct server-to-server
  // calls (like the PowerShell test) never send this, which is why
  // that test worked while the in-app call failed.
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
    if (!payload.employeeDbId || !payload.companyCode || !payload.employeeCode || !payload.password) {
      throw new Error("employeeDbId, companyCode, employeeCode and password are all required.");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const internalEmail = `${payload.companyCode.toLowerCase()}.${payload.employeeCode.toLowerCase()}@internal.sktraining`;

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: payload.password,
      email_confirm: true,
    });

    if (createError) throw new Error(createError.message);

    const { error: linkError } = await supabaseAdmin
      .from("employees")
      .update({ auth_user_id: created.user.id })
      .eq("id", payload.employeeDbId);

    if (linkError) throw new Error(linkError.message);

    return new Response(
      JSON.stringify({ success: true, authUserId: created.user.id, internalEmail }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});