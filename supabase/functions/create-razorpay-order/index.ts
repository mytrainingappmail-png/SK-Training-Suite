// supabase/functions/create-razorpay-order/index.ts
//
// Supabase Edge Function (Deno runtime — deploy separately via Supabase
// CLI/Dashboard, NOT part of the React app build).
//
// Called by: src/repositories/payment/paymentRepository.ts via
// supabase.functions.invoke('create-razorpay-order', { body: {...} })
//
// The amount is NEVER taken from the request. It is computed here from the
// licence's plan and billing cycle, so a caller cannot open a ₹1 order for a
// year-long renewal. Paying a licence is allowed without signing in (the
// emailed payment link works for anyone), so requests are rate-limited instead.
//
// SETUP REQUIRED:
// 1. Deploy:  supabase functions deploy create-razorpay-order
// 2. Set secrets (Razorpay Dashboard -> Settings -> API Keys):
//      supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxxxx
//      supabase secrets set RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
//    The Key Secret must NEVER be placed in any React/client file —
//    only here, as a server-side secret.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import {
  clientIp,
  corsHeaders,
  HttpError,
  jsonResponse,
  rateLimit,
  serviceClient,
} from "../_shared/auth.ts";

interface OrderRequest {
  companyLicenseId: string;
  // Older clients also send these; they are ignored (the database is the source of truth).
  amountInRupees?: number;
  companyId?: string;
  planId?: string;
}

interface PlanPrices {
  price_monthly: number | null;
  price_yearly: number | null;
  price_six_month: number | null;
}

function expectedRupees(billingCycle: string, plan: PlanPrices): number {
  if (billingCycle === "yearly") return Number(plan.price_yearly ?? 0);
  if (billingCycle === "six_month") return Number(plan.price_six_month ?? Number(plan.price_monthly ?? 0) * 6);
  return Number(plan.price_monthly ?? 0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) {
      throw new HttpError(400, "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured.");
    }

    const admin = serviceClient();
    await rateLimit(admin, `razorpay-order:ip:${clientIp(req)}`, 30, 3600);

    const payload: OrderRequest = await req.json();
    if (!payload.companyLicenseId) throw new HttpError(400, "companyLicenseId is required.");
    await rateLimit(admin, `razorpay-order:license:${payload.companyLicenseId}`, 10, 3600);

    const { data: license, error: licenseError } = await admin
      .from("company_licenses")
      .select("id, company_id, plan_id, billing_cycle, subscription_plans(price_monthly, price_yearly, price_six_month)")
      .eq("id", payload.companyLicenseId)
      .maybeSingle();
    if (licenseError) throw new HttpError(500, "Could not load the licence.");
    if (!license) throw new HttpError(404, "Licence not found.");

    const joined = license.subscription_plans as PlanPrices | PlanPrices[] | null;
    const plan = Array.isArray(joined) ? joined[0] : joined;
    if (!plan) throw new HttpError(400, "This licence has no plan.");

    const rupees = expectedRupees(license.billing_cycle as string, plan);
    if (!(rupees > 0)) throw new HttpError(400, "This plan has no price to pay.");

    const amountInPaise = Math.round(rupees * 100);
    const basicAuth = btoa(`${keyId}:${keySecret}`);

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        notes: {
          companyId: license.company_id,
          companyLicenseId: license.id,
          planId: license.plan_id,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new HttpError(400, `Razorpay API error: ${errText}`);
    }

    const order = await response.json();

    return jsonResponse({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (err) {
    if (err instanceof HttpError) return jsonResponse({ error: err.message }, err.status);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 400);
  }
});
