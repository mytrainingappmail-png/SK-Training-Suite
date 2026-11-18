// supabase/functions/shop-razorpay-order/index.ts
//
// Starts an online (Razorpay) payment for a shop order. The amount is NEVER taken from the browser: it is read from the order in the
// database (found by order number + the customer's secret code or phone). Uses the same RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET secrets
// as the licence payments. Returns what the Razorpay checkout window needs.
//
// Public by design (customers are not signed in) - throttled per network address and per order.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { clientIp, corsHeaders, HttpError, jsonResponse, rateLimit, serviceClient } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) throw new HttpError(400, "Online payment is not set up yet. Please pay by UPI.");
    const apiBase = Deno.env.get("RAZORPAY_API_BASE") || "https://api.razorpay.com";

    const body = await req.json().catch(() => ({}));
    const orderNo = String(body.order_no ?? "").trim();
    const secret = String(body.secret ?? "").trim();
    if (!orderNo || !secret) throw new HttpError(400, "Missing order details.");

    const admin = serviceClient();
    await rateLimit(admin, `shop-rzp-order:ip:${clientIp(req)}`, 40, 3600);
    await rateLimit(admin, `shop-rzp-order:order:${orderNo.toUpperCase()}`, 12, 3600);

    const { data: st } = await admin.from("shop_settings").select("razorpay_enabled, shop_name, enabled").eq("id", true).maybeSingle();
    if (!st?.enabled) throw new HttpError(400, "The shop is closed right now.");
    if (!st.razorpay_enabled) throw new HttpError(400, "Online payment is not available. Please pay by UPI.");

    const { data, error } = await admin.rpc("shop_order_for_payment", { p_order_no: orderNo, p_secret: secret });
    if (error) throw new HttpError(404, error.message);
    const o = (data ?? [])[0] as { id: string; order_no: string; total: number; status: string; customer_name: string; phone: string; email: string | null } | undefined;
    if (!o) throw new HttpError(404, "Order not found.");
    if (!["awaiting_payment", "payment_submitted"].includes(o.status)) throw new HttpError(400, "This order does not need a payment.");

    const amountInPaise = Math.round(Number(o.total) * 100);
    if (!(amountInPaise >= 100)) throw new HttpError(400, "This order has nothing to pay online.");

    const response = await fetch(`${apiBase}/v1/orders`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountInPaise, currency: "INR", receipt: o.order_no, notes: { shopOrderId: o.id, orderNo: o.order_no } }),
    });
    if (!response.ok) throw new HttpError(400, "The payment window could not be opened. Please try again or pay by UPI.");
    const rzpOrder = await response.json();

    await admin.rpc("shop_set_razorpay_order", { p_order: o.id, p_rzp_order: rzpOrder.id });

    return jsonResponse({
      success: true,
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId,
      name: st.shop_name || "Shop",
      description: `Order ${o.order_no}`,
      prefill: { name: o.customer_name, contact: o.phone, email: o.email ?? undefined },
    });
  } catch (err) {
    if (err instanceof HttpError) return jsonResponse({ success: false, error: err.message }, err.status);
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, 400);
  }
});
