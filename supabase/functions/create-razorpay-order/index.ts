// supabase/functions/create-razorpay-order/index.ts
//
// Supabase Edge Function (Deno runtime — deploy separately via Supabase
// CLI/Dashboard, NOT part of the React app build).
//
// Called by: src/repositories/payment/paymentRepository.ts via
// supabase.functions.invoke('create-razorpay-order', { body: {...} })
//
// SETUP REQUIRED:
// 1. Deploy:  supabase functions deploy create-razorpay-order
// 2. Set secrets (Razorpay Dashboard -> Settings -> API Keys):
//      supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxxxx
//      supabase secrets set RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
//    The Key Secret must NEVER be placed in any React/client file —
//    only here, as a server-side secret.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

interface OrderRequest {
  amountInRupees: number;
  companyId: string;
  companyLicenseId: string;
  planId: string;
}

serve(async (req) => {
  try {
    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) {
      throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured.");
    }

    const payload: OrderRequest = await req.json();
    if (!payload.amountInRupees || payload.amountInRupees <= 0) {
      throw new Error("Invalid amount.");
    }

    const amountInPaise = Math.round(payload.amountInRupees * 100);
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
          companyId: payload.companyId,
          companyLicenseId: payload.companyLicenseId,
          planId: payload.planId,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Razorpay API error: ${errText}`);
    }

    const order = await response.json();

    return new Response(
      JSON.stringify({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { headers: { "Content-Type": "application/json" }, status: 400 }
    );
  }
});
