// supabase/functions/update-employee-auth-password/index.ts
//
// Companion to provision-employee-auth: that one sets an employee's
// INITIAL real Supabase Auth password at migration time. This one keeps
// it in sync afterward — every place a password can be changed for an
// already-migrated employee (self-service "Change Password", or an
// admin's "Reset Password" in Employee Management) must call this too,
// or the employee ends up locked out: the employees.password column
// shows the new value, but the REAL login (which migrated employees
// actually authenticate against) still has the old one.
//
// Requires the SERVICE ROLE key — never callable from the browser
// directly, only via supabase.functions.invoke from already-authorized
// app code. Uses the SAME secrets already configured for
// provision-employee-auth (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) —
// no additional setup needed.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface UpdateRequest {
  authUserId: string;
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

    const payload: UpdateRequest = await req.json();
    if (!payload.authUserId || !payload.newPassword) {
      throw new Error("authUserId and newPassword are both required.");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(payload.authUserId, {
      password: payload.newPassword,
    });

    if (error) throw new Error(error.message);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
