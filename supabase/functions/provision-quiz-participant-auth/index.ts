// supabase/functions/provision-quiz-participant-auth/index.ts
//
// Anonymous Sign-Ins are disabled on this Supabase project (a project-
// level Auth provider toggle in the dashboard, not something this app
// changes for itself) — Live Quiz participants still need a REAL,
// verifiable auth.uid() so RLS and Realtime can scope quiz_sessions /
// quiz_participants / quiz_answers to just their own session, exactly
// like a logged-in quiz_admin. This creates a throwaway, single-purpose
// Auth user (random email under @internal.sktraining.quiz, random
// password) via the service role and returns the credentials so the
// browser can sign in for real with supabase-js. The client saves these
// credentials in its own localStorage and REUSES them on every future
// visit from that browser instead of minting a new user per join, so a
// device that plays 50 quizzes still only ever creates one auth user.
//
// Needs the SERVICE ROLE key — must run as an Edge Function.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const token = crypto.randomUUID();
    const email = `participant-${token}@internal.sktraining.quiz`;
    const password = crypto.randomUUID() + crypto.randomUUID();

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) throw new Error(createError.message);

    return new Response(
      JSON.stringify({ success: true, email, password, authUserId: created.user.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
