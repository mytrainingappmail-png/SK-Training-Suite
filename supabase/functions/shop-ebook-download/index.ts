// supabase/functions/shop-ebook-download/index.ts
//
// Hands out a short-lived download link for an e-book a customer has bought. The files sit in a PRIVATE bucket (shop-ebooks), so
// nobody can open them directly; this function asks the database whether THIS order (order number + its secret code or the phone
// number used) is paid, owns THIS e-book and is still inside the owner's download limit (shop_authorize_download, which only the
// service role may call), and only then signs a link that works for one minute.
//
// Public by design (customers are not signed in), so it is throttled per network address and per order.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { clientIp, corsHeaders, HttpError, jsonResponse, rateLimit, serviceClient } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const orderNo = String(body.order_no ?? "").trim();
    const secret = String(body.secret ?? "").trim();
    const itemId = String(body.item_id ?? "").trim();
    if (!orderNo || !secret || !itemId) throw new HttpError(400, "Missing order details.");

    const admin = serviceClient();
    await rateLimit(admin, `shop-dl:ip:${clientIp(req)}`, 60, 3600);
    await rateLimit(admin, `shop-dl:order:${orderNo.toUpperCase()}`, 20, 3600);

    const { data, error } = await admin.rpc("shop_authorize_download", { p_order_no: orderNo, p_secret: secret, p_item: itemId });
    if (error) throw new HttpError(403, error.message);
    const row = (data ?? [])[0] as { file_path: string; file_name: string } | undefined;
    if (!row) throw new HttpError(404, "This e-book is not available.");

    const ext = row.file_path.includes(".") ? row.file_path.split(".").pop() : "pdf";
    const niceName = /\.[A-Za-z0-9]{2,5}$/.test(row.file_name) ? row.file_name : `${row.file_name}.${ext}`;
    const { data: signed, error: signError } = await admin.storage.from("shop-ebooks").createSignedUrl(row.file_path, 60, { download: niceName });
    if (signError || !signed?.signedUrl) throw new HttpError(500, "The file could not be prepared. Please try again.");

    return jsonResponse({ success: true, url: signed.signedUrl });
  } catch (err) {
    return jsonResponse(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      err instanceof HttpError ? err.status : 400,
    );
  }
});
