// supabase/functions/shop-razorpay-verify/index.ts
//
// Called by the customer's page right after the Razorpay window reports success. The browser's word is not trusted: the payment's
// signature is checked with the secret key (only Razorpay can produce it), the Razorpay order is read back to confirm it belongs to
// THIS shop order and was paid in full, and only then is the order marked paid (once - the webhook may confirm the same payment too).
// The invoice email goes out right after.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { clientIp, corsHeaders, HttpError, jsonResponse, rateLimit, safeEqual, serviceClient } from "../_shared/auth.ts";
import { sendShopInvoice } from "../_shared/shopInvoice.ts";

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) throw new HttpError(400, "Online payment is not set up.");
    const apiBase = Deno.env.get("RAZORPAY_API_BASE") || "https://api.razorpay.com";

    const b = await req.json().catch(() => ({}));
    const orderNo = String(b.order_no ?? "").trim();
    const secret = String(b.secret ?? "").trim();
    const rzpOrderId = String(b.razorpay_order_id ?? "").trim();
    const paymentId = String(b.razorpay_payment_id ?? "").trim();
    const signature = String(b.razorpay_signature ?? "").trim();
    if (!orderNo || !secret || !rzpOrderId || !paymentId || !signature) throw new HttpError(400, "Missing payment details.");

    const admin = serviceClient();
    await rateLimit(admin, `shop-rzp-verify:ip:${clientIp(req)}`, 60, 3600);

    // 1) the signature must be Razorpay's
    const expected = await hmacHex(keySecret, `${rzpOrderId}|${paymentId}`);
    if (!safeEqual(expected, signature)) throw new HttpError(400, "The payment could not be verified.");

    // 2) the order must be this customer's
    const { data, error } = await admin.rpc("shop_order_for_payment", { p_order_no: orderNo, p_secret: secret });
    if (error) throw new HttpError(404, error.message);
    const o = (data ?? [])[0] as { id: string; total: number; status: string } | undefined;
    if (!o) throw new HttpError(404, "Order not found.");

    // 3) Razorpay itself says that order is for THIS shop order and was paid in full
    const r = await fetch(`${apiBase}/v1/orders/${encodeURIComponent(rzpOrderId)}`, { headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` } });
    if (!r.ok) throw new HttpError(400, "The payment could not be checked. If money was taken, it will be confirmed shortly.");
    const rzpOrder = await r.json();
    if (rzpOrder?.notes?.shopOrderId !== o.id) throw new HttpError(400, "This payment belongs to a different order.");
    const paidPaise = Number(rzpOrder.amount_paid ?? 0);
    if (rzpOrder.status !== "paid" && !(paidPaise >= Math.round(Number(o.total) * 100))) {
      throw new HttpError(400, "The payment is not complete yet. If money was taken, it will be confirmed shortly.");
    }

    const { data: res, error: markError } = await admin.rpc("shop_mark_paid_razorpay", {
      p_order: o.id, p_payment_id: paymentId, p_rzp_order: rzpOrderId, p_amount_paise: paidPaise,
    });
    if (markError) throw new HttpError(500, "The order could not be updated. If money was taken, it will be confirmed shortly.");
    const result = res as { ok: boolean; changed?: boolean; reason?: string; status?: string };
    if (!result.ok) throw new HttpError(409, "We received your payment but the order needs a quick check. The shop will contact you.");

    let invoice: { sent: boolean; reason?: string } = { sent: false, reason: "skipped" };
    if (result.changed) invoice = await sendShopInvoice(admin, o.id).catch(() => ({ sent: false, reason: "error" }));

    return jsonResponse({ success: true, status: result.status ?? "paid", invoice_sent: invoice.sent });
  } catch (err) {
    if (err instanceof HttpError) return jsonResponse({ success: false, error: err.message }, err.status);
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, 400);
  }
});
