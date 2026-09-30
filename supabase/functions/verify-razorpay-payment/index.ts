// supabase/functions/verify-razorpay-payment/index.ts
//
// Supabase Edge Function (Deno runtime — deploy separately).
//
// This should be configured as the Webhook URL in your Razorpay
// Dashboard (Settings -> Webhooks), listening for the "payment.captured"
// event. Razorpay calls this directly (not your React app), so payment
// confirmation can never be spoofed by tampering with client-side code.
//
// On a verified successful payment, it extends the company's licence
// (matching the plan's billing cycle) and resets its status to "active" —
// the auto-renew half of the grace-period logic.
//
// Safe against the two ways a webhook can go wrong:
//   * Razorpay retries deliveries — each payment id is claimed once in
//     razorpay_payments, so a retry never renews a second time.
//   * Amount mismatch — the paid amount/currency must cover the licence's
//     price (computed from its plan and billing cycle); otherwise the payment
//     is recorded as rejected and the licence is NOT renewed.
//
// SETUP REQUIRED:
// 1. Deploy:  supabase functions deploy verify-razorpay-payment --no-verify-jwt
// 2. Set secrets:
//      supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
// 3. In Razorpay Dashboard -> Webhooks, add this function's URL and set
//    the SAME secret as RAZORPAY_WEBHOOK_SECRET above, subscribe to the
//    "payment.captured" event.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { safeEqual, serviceClient } from "../_shared/auth.ts";

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
  return safeEqual(expected, signature);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, status });
}

serve(async (req) => {
  try {
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("Required secrets are not configured.");
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";
    const isValid = await verifySignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      return json({ error: "Invalid signature." }, 401);
    }

    const event = JSON.parse(rawBody);
    if (event.event !== "payment.captured") {
      // Not the event we care about — acknowledge and exit quietly.
      return json({ received: true });
    }

    const payment = event.payload?.payment?.entity ?? {};
    const paymentId: string | undefined = payment.id;
    const notes = payment.notes ?? {};
    const companyLicenseId: string | undefined = notes.companyLicenseId;
    if (!paymentId) throw new Error("Payment has no id.");
    if (!companyLicenseId) {
      throw new Error("Payment has no companyLicenseId in its notes — cannot identify which license to renew.");
    }

    const supabase = serviceClient();

    // Claim this payment. A retry of the same webhook hits the primary key
    // and stops here instead of renewing twice.
    const { error: claimError } = await supabase.from("razorpay_payments").insert({
      payment_id: paymentId,
      order_id: payment.order_id ?? null,
      company_license_id: companyLicenseId,
      amount_paise: Number(payment.amount ?? 0),
      currency: payment.currency ?? null,
      status: "processing",
    });
    if (claimError) {
      if (claimError.code === "23505") return json({ success: true, duplicate: true });
      throw new Error(claimError.message);
    }

    const release = async () => {
      await supabase.from("razorpay_payments").delete().eq("payment_id", paymentId).eq("status", "processing");
    };

    try {
      const { data: license, error: licenseError } = await supabase
        .from("company_licenses")
        .select("*, subscription_plans(price_monthly, price_yearly, price_six_month)")
        .eq("id", companyLicenseId)
        .maybeSingle();
      if (licenseError) throw new Error(licenseError.message);
      if (!license) throw new Error(`No company_license found with id ${companyLicenseId}.`);

      const joined = license.subscription_plans as Record<string, number | null> | Record<string, number | null>[] | null;
      const plan = Array.isArray(joined) ? joined[0] : joined;
      const monthly = Number(plan?.price_monthly ?? 0);
      const expectedRupees = license.billing_cycle === "yearly"
        ? Number(plan?.price_yearly ?? 0)
        : license.billing_cycle === "six_month"
          ? Number(plan?.price_six_month ?? monthly * 6)
          : monthly;
      const expectedPaise = Math.round(expectedRupees * 100);

      if (payment.currency !== "INR" || !(expectedPaise > 0) || Number(payment.amount) < expectedPaise) {
        await supabase
          .from("razorpay_payments")
          .update({ status: "rejected", note: `expected ${expectedPaise} INR paise, got ${payment.amount} ${payment.currency}` })
          .eq("payment_id", paymentId);
        // Acknowledge so Razorpay stops retrying; an operator can review the row.
        return json({ success: false, rejected: true });
      }

      const currentEnd = new Date(license.end_date);
      const baseDate = currentEnd > new Date() ? currentEnd : new Date();
      const newEnd = new Date(baseDate);
      if (license.billing_cycle === "yearly") {
        newEnd.setFullYear(newEnd.getFullYear() + 1);
      } else if (license.billing_cycle === "six_month") {
        newEnd.setMonth(newEnd.getMonth() + 6);
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

      await supabase.from("razorpay_payments").update({ status: "renewed" }).eq("payment_id", paymentId);

      return json({ success: true, newEndDate: newEnd.toISOString().slice(0, 10) });
    } catch (inner) {
      // Let Razorpay's retry try again from a clean slate.
      await release();
      throw inner;
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 400);
  }
});
