// supabase/functions/send-license-notification/index.ts
//
// Supabase Edge Function (Deno runtime — NOT part of the React app,
// deployed separately via the Supabase CLI or Dashboard).
//
// Called by: src/services/license/licenseNotificationService.ts via
// supabase.functions.invoke('send-license-notification', { body: {...} })
//
// SETUP REQUIRED BEFORE THIS WORKS:
// 1. Deploy this function:  supabase functions deploy send-license-notification
// 2. Set secrets (Supabase Dashboard -> Edge Functions -> Secrets, or CLI):
//      supabase secrets set RESEND_API_KEY=your_resend_api_key
//      supabase secrets set RESEND_FROM_EMAIL=billing@yourdomain.com
//      supabase secrets set WHATSAPP_API_URL=your_whatsapp_provider_endpoint
//      supabase secrets set WHATSAPP_API_KEY=your_whatsapp_provider_key
// 3. Email uses Resend (https://resend.com) — swap the fetch call below
//    for any other provider (SendGrid, Postmark, etc.) if you prefer.
// 4. WhatsApp: this template calls a generic HTTP endpoint — plug in
//    whichever provider you choose (Meta Cloud API, Twilio, Gupshup...).
//    The exact request body will differ per provider; adjust the
//    sendWhatsApp() function accordingly.
// 5. To run this automatically every day, add a Cron Trigger in the
//    Supabase Dashboard (Edge Functions -> your function -> Cron) that
//    calls this SAME function on a schedule, OR create a second small
//    "scheduler" function that loops company licenses server-side and
//    invokes this one per notification (mirrors licenseNotificationService.ts).

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

interface NotificationPayload {
  channel: "email" | "whatsapp";
  notificationType: "expiry_7_days" | "expiry_3_days" | "expiry_today" | "grace_period_started" | "suspended";
  companyName: string;
  companyEmail: string;
  companyMobile: string;
  planName: string;
  endDate: string;
  gracePeriodDays: number;
}

function buildMessage(payload: NotificationPayload): { subject: string; body: string } {
  const dateStr = new Date(payload.endDate).toLocaleDateString();
  const messages: Record<NotificationPayload["notificationType"], { subject: string; body: string }> = {
    expiry_7_days: {
      subject: `Your ${payload.planName} subscription expires in 7 days`,
      body: `Hi ${payload.companyName}, your ${payload.planName} subscription will expire on ${dateStr} (7 days from now). Please renew to avoid any interruption.`,
    },
    expiry_3_days: {
      subject: `Your ${payload.planName} subscription expires in 3 days`,
      body: `Hi ${payload.companyName}, your ${payload.planName} subscription will expire on ${dateStr} (3 days from now). Please renew soon.`,
    },
    expiry_today: {
      subject: `Your ${payload.planName} subscription expires today`,
      body: `Hi ${payload.companyName}, your ${payload.planName} subscription expires today (${dateStr}).${payload.gracePeriodDays > 0 ? ` You have a ${payload.gracePeriodDays}-day grace period after this.` : " Please renew now to keep access."}`,
    },
    grace_period_started: {
      subject: `Your ${payload.planName} subscription is in its grace period`,
      body: `Hi ${payload.companyName}, your subscription expired on ${dateStr}. You have ${payload.gracePeriodDays} day(s) of grace period remaining before access is restricted.`,
    },
    suspended: {
      subject: `Your ${payload.planName} subscription has been suspended`,
      body: `Hi ${payload.companyName}, your subscription access has been suspended. Please contact us to reactivate.`,
    },
  };
  return messages[payload.notificationType];
}

async function sendEmail(payload: NotificationPayload): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !fromEmail) throw new Error("RESEND_API_KEY / RESEND_FROM_EMAIL not configured.");
  if (!payload.companyEmail) throw new Error("Company has no email on file.");

  const { subject, body } = buildMessage(payload);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: payload.companyEmail,
      subject,
      text: body,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Resend API error: ${errText}`);
  }
}

async function sendWhatsApp(payload: NotificationPayload): Promise<void> {
  const apiUrl = Deno.env.get("WHATSAPP_API_URL");
  const apiKey = Deno.env.get("WHATSAPP_API_KEY");
  if (!apiUrl || !apiKey) throw new Error("WHATSAPP_API_URL / WHATSAPP_API_KEY not configured.");
  if (!payload.companyMobile) throw new Error("Company has no mobile number on file.");

  const { body } = buildMessage(payload);

  // NOTE: request shape below is a generic placeholder — replace with
  // your actual WhatsApp provider's documented request format.
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: payload.companyMobile,
      message: body,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`WhatsApp API error: ${errText}`);
  }
}

serve(async (req) => {
  try {
    const payload: NotificationPayload = await req.json();

    if (payload.channel === "email") {
      await sendEmail(payload);
    } else if (payload.channel === "whatsapp") {
      await sendWhatsApp(payload);
    } else {
      throw new Error(`Unknown channel: ${payload.channel}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
