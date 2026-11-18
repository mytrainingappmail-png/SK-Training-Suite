// Builds and sends the shop's email invoice (through Resend, with the same RESEND_API_KEY / RESEND_FROM_EMAIL secrets the rest of the
// platform already uses). Called by the server after an order is paid (Razorpay confirmation, Razorpay webhook, or from the owner's
// "send again" button). Never throws for "normal" reasons (no email, switched off...) - it answers with why it did not send.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface InvoiceData {
  order: Record<string, unknown>;
  items: Record<string, unknown>[];
  settings: Record<string, unknown>;
}

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export async function sendShopInvoice(
  admin: SupabaseClient,
  orderId: string,
  force = false,
): Promise<{ sent: boolean; reason?: string }> {
  const { data, error } = await admin.rpc("shop_order_invoice_data", { p_order: orderId });
  if (error || !data) return { sent: false, reason: "order_not_found" };
  const d = data as InvoiceData;
  const o = d.order;
  const s = d.settings;

  const to = String(o.email ?? "").trim();
  if (!to) return { sent: false, reason: "no_email" };
  if (!["paid", "shipped", "delivered"].includes(String(o.status))) return { sent: false, reason: "not_paid" };
  if (!force && s.send_invoice_email === false) return { sent: false, reason: "disabled" };
  if (!force && o.invoice_sent_at) return { sent: false, reason: "already_sent" };

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !fromEmail) return { sent: false, reason: "email_not_configured" };

  const sym = String(s.currency_symbol ?? "₹");
  const money = (n: unknown) => `${sym}${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const shop = String(s.shop_name ?? "").trim() || "Our shop";
  const site = String(s.public_site_url ?? Deno.env.get("SHOP_SITE_URL") ?? "").trim().replace(/\/+$/, "");
  const link = site ? `${site}/shop/order/${encodeURIComponent(String(o.order_no))}?t=${encodeURIComponent(String(o.token))}` : "";
  const date = new Date(String(o.paid_at ?? o.created_at)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

  const rows = d.items.map((i) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827">${esc(i.title)}<br><span style="font-size:12px;color:#6b7280">${i.format === "ebook" ? "E-book" : "Book"} × ${esc(i.qty)}</span></td>
      <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;white-space:nowrap">${money(i.line_total)}</td>
    </tr>`).join("");

  const line = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 0;font-size:${strong ? 16 : 14}px;color:${strong ? "#111827" : "#4b5563"};font-weight:${strong ? 800 : 400}">${label}</td><td style="padding:4px 0;font-size:${strong ? 16 : 14}px;color:#111827;font-weight:${strong ? 800 : 600};text-align:right">${value}</td></tr>`;

  const payVia = o.payment_method === "razorpay" ? "Paid online" : "Paid by UPI";
  const payRef = o.payment_utr ? ` · Ref ${esc(o.payment_utr)}` : "";
  const hasEbook = d.items.some((i) => i.format === "ebook");
  const address = o.has_physical
    ? `<p style="margin:16px 0 0;font-size:13px;color:#4b5563"><b>Delivering to</b><br>${esc(o.customer_name)}<br>${esc(o.ship_address)}, ${esc(o.ship_city)}, ${esc(o.ship_state)} - ${esc(o.ship_pincode)}<br>${esc(o.phone)}</p>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden" cellpadding="0" cellspacing="0">
      <tr><td style="background:#0e1c3d;padding:22px 24px"><div style="font-size:20px;font-weight:800;color:#ffffff">${esc(shop)}</div><div style="font-size:13px;color:#fbbf24;margin-top:2px">Invoice · Order ${esc(o.order_no)}</div></td></tr>
      <tr><td style="padding:24px">
        <p style="margin:0 0 4px;font-size:16px;color:#111827">Hello ${esc(o.customer_name)},</p>
        <p style="margin:0 0 18px;font-size:14px;color:#4b5563;white-space:pre-line">${esc(String(s.invoice_message ?? "").trim() || "We have received your payment. Here is your invoice.")}</p>
        <p style="margin:0 0 6px;font-size:12px;color:#6b7280">${esc(date)} · ${payVia}${payRef}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px">
          ${line("Subtotal", money(o.subtotal))}
          ${Number(o.discount) > 0 ? line(`Coupon ${esc(o.coupon_code)}`, "− " + money(o.discount)) : ""}
          ${o.has_physical ? line("Shipping", Number(o.shipping) > 0 ? money(o.shipping) : "Free") : ""}
          ${line("Total paid", money(o.total), true)}
        </table>
        ${address}
        ${link ? `<p style="margin:22px 0 0;text-align:center"><a href="${link}" style="display:inline-block;background:#fbbf24;color:#111827;font-weight:800;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:10px">${hasEbook ? "Download your e-book / view your order" : "View your order"}</a></p>` : ""}
        ${s.thank_you_note ? `<p style="margin:20px 0 0;font-size:13px;color:#4b5563;white-space:pre-line">${esc(s.thank_you_note)}</p>` : ""}
      </td></tr>
      <tr><td style="background:#f9fafb;padding:16px 24px;font-size:12px;color:#6b7280;line-height:1.5">
        ${s.invoice_details ? `<div style="white-space:pre-line;margin-bottom:8px">${esc(s.invoice_details)}</div>` : ""}
        ${s.contact_email ? `Questions? ${esc(s.contact_email)}` : ""}${s.support_phone ? ` · ${esc(s.support_phone)}` : ""}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  const text = `${shop} - Invoice, order ${o.order_no}\n\n` +
    d.items.map((i) => `${i.title} (${i.format === "ebook" ? "E-book" : "Book"}) x${i.qty}: ${money(i.line_total)}`).join("\n") +
    `\n\nTotal paid: ${money(o.total)}\n${link ? `\nYour order: ${link}\n` : ""}`;

  const response = await fetch(`${Deno.env.get("RESEND_API_BASE") || "https://api.resend.com"}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject: (String(s.invoice_subject ?? "").trim() || "Your invoice - order {order_no}").replace(/{order_no}/g, String(o.order_no)).replace(/{shop_name}/g, shop),
      html,
      text,
      reply_to: s.contact_email || undefined,
    }),
  });
  if (!response.ok) return { sent: false, reason: `email_error: ${(await response.text()).slice(0, 200)}` };

  await admin.rpc("shop_mark_invoice_sent", { p_order: orderId });
  return { sent: true };
}
