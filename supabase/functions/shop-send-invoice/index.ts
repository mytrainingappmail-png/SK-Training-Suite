// supabase/functions/shop-send-invoice/index.ts
//
// The shop owner's "send the invoice (again)" button. Only the platform owner's administrators may call it; it emails the order's
// customer (never anyone else) from the platform's own mail account.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { corsHeaders, HttpError, jsonResponse, rateLimit, requireEmployeeCaller, serviceClient } from "../_shared/auth.ts";
import { sendShopInvoice } from "../_shared/shopInvoice.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = serviceClient();
    const caller = await requireEmployeeCaller(req, admin);
    if (!caller.companyIsOperator) throw new HttpError(403, "Only the shop owner can send invoices.");
    await rateLimit(admin, `shop-invoice:${caller.employeeId}`, 120, 3600);

    const body = await req.json().catch(() => ({}));
    const orderId = String(body.order_id ?? "").trim();
    if (!orderId) throw new HttpError(400, "order_id is required.");

    const result = await sendShopInvoice(admin, orderId, true);
    return jsonResponse({ success: true, ...result });
  } catch (err) {
    if (err instanceof HttpError) return jsonResponse({ success: false, error: err.message }, err.status);
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, 400);
  }
});
