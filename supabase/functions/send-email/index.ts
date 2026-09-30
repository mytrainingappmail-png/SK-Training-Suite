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
// This sends from the platform's own verified domain, so it must not be an
// open relay. The caller has to be a signed-in employee, is rate-limited, and
// may only write to people the app itself knows about: employees/companies of
// their own company, the platform operator's support staff, or (for the
// operator's own administrators) any company/employee.
//
// Callers are expected to catch and swallow failures for non-critical
// sends (e.g. a ticket-created notice) — email delivery must never block
// the underlying database operation. This function returns success:false
// with a message rather than throwing, so callers get a clean signal.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import {
  corsHeaders,
  escapeLike,
  HttpError,
  jsonResponse,
  rateLimit,
  requireEmployeeCaller,
  serviceClient,
  type Caller,
} from "../_shared/auth.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const MAX_PER_HOUR = 60;

async function recipientAllowed(admin: SupabaseClient, caller: Caller, to: string): Promise<boolean> {
  const pattern = escapeLike(to);

  const [{ data: employees }, { data: companies }] = await Promise.all([
    admin.from("employees").select("company_id, companies(is_platform_operator)").ilike("email", pattern).limit(20),
    admin.from("companies").select("id, is_platform_operator").ilike("email", pattern).limit(20),
  ]);

  const isOperatorCaller = caller.isSuperAdmin && caller.companyIsOperator;

  for (const e of employees ?? []) {
    const join = e.companies as { is_platform_operator?: boolean } | { is_platform_operator?: boolean }[] | null;
    const co = Array.isArray(join) ? join[0] : join;
    if (isOperatorCaller || e.company_id === caller.companyId || co?.is_platform_operator === true) return true;
  }
  for (const c of companies ?? []) {
    if (isOperatorCaller || c.id === caller.companyId || c.is_platform_operator === true) return true;
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = serviceClient();
    const caller = await requireEmployeeCaller(req, admin);
    await rateLimit(admin, `send-email:${caller.employeeId}`, MAX_PER_HOUR, 3600, "Email limit reached. Please try again in an hour.");

    const apiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    if (!apiKey || !fromEmail) {
      throw new HttpError(400, "RESEND_API_KEY / RESEND_FROM_EMAIL not configured.");
    }

    const payload: SendEmailRequest = await req.json();
    const to = (payload.to ?? "").trim();
    if (!to || !payload.subject || !payload.html) {
      throw new HttpError(400, "to, subject and html are all required.");
    }
    if (!EMAIL_RE.test(to)) throw new HttpError(400, "Enter a single valid recipient email address.");
    if (payload.subject.length > 300) throw new HttpError(400, "Subject is too long.");
    if (payload.html.length > 200_000) throw new HttpError(400, "Message is too large.");

    if (!(await recipientAllowed(admin, caller, to))) {
      throw new HttpError(403, "You can only email people who belong to your company or the support team.");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text ?? payload.html.replace(/<[^>]+>/g, " "),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new HttpError(400, `Resend API error: ${errText}`);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    if (err instanceof HttpError) return jsonResponse({ success: false, error: err.message }, err.status);
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, 400);
  }
});
