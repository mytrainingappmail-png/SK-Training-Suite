// supabase/functions/send-email/index.ts
//
// Generic transactional email sender — Supabase Edge Function (Deno runtime).
// Reuses the SAME Resend secrets already documented for
// send-license-notification, so no second email provider setup is needed:
//      supabase secrets set RESEND_API_KEY=your_resend_api_key
//      supabase secrets set RESEND_FROM_EMAIL=noreply@yourdomain.com
//
// Called by: src/repositories/email/emailRepository.ts via
// supabase.functions.invoke('send-email', { body: {...} })
//
// Callers are expected to catch and swallow failures for non-critical
// sends (e.g. a ticket-created notice) — email delivery must never block
// the underlying database operation. This function returns success:false
// with a message rather than throwing, so callers get a clean signal.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    if (!apiKey || !fromEmail) {
      throw new Error("RESEND_API_KEY / RESEND_FROM_EMAIL not configured.");
    }

    const payload: SendEmailRequest = await req.json();
    if (!payload.to || !payload.subject || !payload.html) {
      throw new Error("to, subject and html are all required.");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text ?? payload.html.replace(/<[^>]+>/g, " "),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Resend API error: ${errText}`);
    }

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
