// supabase/functions/verify-razorpay-payment/index.ts
//
// Supabase Edge Function (Deno runtime — deploy separately).
//
// This should be configured as the Webhook URL in your Razorpay
// Dashboard (Settings -> Webhooks), listening for the "payment.captured"
// event. Razorpay calls this directly (not your React app), so payment
// confirmation can never be spoofed by tampering with client-side code.
//
// On a verified successful payment, it automatically extends the
// company's license (matching the plan's billing cycle) and resets its
// status to "active" — this is the auto-renew half of Phase 2's
// grace-period logic.
//
// SETUP REQUIRED:
// 1. Deploy:  supabase functions deploy verify-razorpay-payment
// 2. Set secrets:
//      supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
//      supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
//      supabase secrets set SUPABASE_URL=https://yourproject.supabase.co
// 3. In Razorpay Dashboard -> Webhooks, add this function's URL and set
//    the SAME secret as RAZORPAY_WEBHOOK_SECRET above, subscribe to the
//    "payment.captured" event.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === signature;
}

serve(async (req) => {
  try {
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
      throw new Error("Required secrets are not configured.");
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";
    const isValid = await verifySignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature." }), { status: 401 });
    }

    const event = JSON.parse(rawBody);
    if (event.event !== "payment.captured") {
      // Not the event we care about — acknowledge and exit quietly.
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    const notes = event.payload?.payment?.entity?.notes ?? {};
    const companyLicenseId: string | undefined = notes.companyLicenseId;
    if (!companyLicenseId) {
      throw new Error("Payment has no companyLicenseId in its notes — cannot identify which license to renew.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: license, error: licenseError } = await supabase
      .from("company_licenses")
      .select("*")
      .eq("id", companyLicenseId)
      .maybeSingle();
    if (licenseError) throw new Error(licenseError.message);
    if (!license) throw new Error(`No company_license found with id ${companyLicenseId}.`);

    const currentEnd = new Date(license.end_date);
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    const newEnd = new Date(baseDate);
    if (license.billing_cycle === "yearly") {
      newEnd.setFullYear(newEnd.getFullYear() + 1);
    } else {
      newEnd.setMonth(newEnd.getMonth() + 1);
    }

    const { error: updateError } = await supabase
      .from("company_licenses")
      .update({
        end_date: newEnd.toISOString().slice(0, 10),
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", companyLicenseId);
    if (updateError) throw new Error(updateError.message);

    return new Response(JSON.stringify({ success: true, newEndDate: newEnd.toISOString().slice(0, 10) }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { headers: { "Content-Type": "application/json" }, status: 400 }
    );
  }
});
