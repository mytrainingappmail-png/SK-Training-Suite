// Shop settings: the shop's name and wording, how customers pay (UPI id, QR), shipping, contact details, policies and order options.
// Nothing here is built into the app - the public shop shows exactly what is saved on this screen.

import { useEffect, useRef, useState } from 'react';
import { loadShopSettings, saveShopSettings, uploadShopImage } from '../../services/shop/shopAdminService';
import type { ShopSettings } from '../../services/shop/shopAdminService';
import { A_BTN, A_BTN_LIGHT, A_INPUT, Card, Field, Notice, Toggle } from './shopAdminUi';

export default function ShopSettingsPanel({ onSaved }: { onSaved: () => void }) {
  const [s, setS] = useState<ShopSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const qrRef = useRef<HTMLInputElement>(null);

  // the link inside emails needs the site's address; it is filled in from the page you are on when still empty
  useEffect(() => { loadShopSettings().then((x) => setS({ ...x, public_site_url: x.public_site_url || window.location.origin })).catch((e: unknown) => setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Could not load.' })); }, []);
  if (!s) return msg ? <Notice kind="error">{msg.text}</Notice> : <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;

  function set<K extends keyof ShopSettings>(k: K, v: ShopSettings[K]) { setS((x) => (x ? { ...x, [k]: v } : x)); setMsg(null); }
  const text = (k: keyof ShopSettings) => (s[k] as string | null) ?? '';

  async function save() {
    if (!s) return;
    setSaving(true); setMsg(null);
    try {
      await saveShopSettings(s);
      setMsg({ kind: 'ok', text: 'Saved. The shop now shows these details.' });
      onSaved();
    } catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save.' }); }
    finally { setSaving(false); }
  }

  async function uploadQr(file: File | undefined) {
    if (!file) return;
    setUploading(true); setMsg(null);
    try { set('upi_qr_url', await uploadShopImage(file, 'qr')); }
    catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Could not upload.' }); }
    finally { setUploading(false); if (qrRef.current) qrRef.current.value = ''; }
  }

  return (
    <div className="space-y-5">
      <Card title="Shop name and wording" subtitle="What visitors see at the top of the shop.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Shop name"><input className={A_INPUT} value={text('shop_name')} onChange={(e) => set('shop_name', e.target.value)} placeholder="e.g. your name / brand" /></Field>
          <Field label="Small line above the name" hint="e.g. what the shop is about"><input className={A_INPUT} value={text('tagline')} onChange={(e) => set('tagline', e.target.value)} /></Field>
          <Field label="Welcome message" className="sm:col-span-2"><textarea className={A_INPUT} rows={3} value={text('intro_text')} onChange={(e) => set('intro_text', e.target.value)} /></Field>
        </div>
      </Card>

      <Card title="💳 Payment by UPI" subtitle="Customers pay to this UPI id by their UPI app or by scanning a QR; you confirm each payment yourself in the Orders tab.">
        <div className="space-y-4">
          <Toggle checked={s.accept_upi} onChange={(v) => set('accept_upi', v)} label="Accept UPI payments" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your UPI ID" hint="e.g. name@bank — customers pay to this"><input className={A_INPUT} value={text('upi_id')} onChange={(e) => set('upi_id', e.target.value)} placeholder="name@upi" /></Field>
            <Field label="Name shown in the UPI app" hint="the name on your UPI account"><input className={A_INPUT} value={text('upi_payee_name')} onChange={(e) => set('upi_payee_name', e.target.value)} /></Field>
          </div>
          <Field label="Your own QR picture (optional)" hint="A QR with the exact amount is already made for every order. Add your own QR here only if you also want it shown.">
            <div className="flex flex-wrap items-center gap-3">
              <input ref={qrRef} type="file" accept="image/*" className="hidden" onChange={(e) => void uploadQr(e.target.files?.[0])} />
              <button type="button" onClick={() => qrRef.current?.click()} className={A_BTN_LIGHT} disabled={uploading}>{uploading ? 'Uploading…' : s.upi_qr_url ? 'Change QR picture' : '⬆ Upload QR picture'}</button>
              {s.upi_qr_url && (
                <>
                  <img src={s.upi_qr_url} alt="QR" className="h-20 w-20 rounded-lg object-contain ring-1 ring-slate-200" />
                  <button type="button" className="text-xs font-semibold text-red-500" onClick={() => set('upi_qr_url', null)}>Remove</button>
                </>
              )}
            </div>
          </Field>
        </div>
      </Card>

      <Card title="💳 Online payment (Razorpay)" subtitle="Customers can pay by card, UPI, netbanking or wallet; the order is confirmed by itself and nothing is left for you to check. UPI / QR with your own confirmation stays available too.">
        <div className="space-y-3">
          <Toggle checked={s.razorpay_enabled} onChange={(v) => set('razorpay_enabled', v)} label={s.razorpay_enabled ? 'Online payment is ON' : 'Online payment is OFF'} />
          <p className="text-xs text-slate-500">The Razorpay account keys are kept safely on the server (the same account used for platform licence payments). Money goes to that Razorpay account. If a customer should get a refund, do it in the Razorpay dashboard and then cancel the order here.</p>
        </div>
      </Card>

      <Card title="✉️ Invoice email" subtitle="Sent to the customer automatically when an order is paid. You can also send it again from the Orders tab.">
        <div className="space-y-4">
          <Toggle checked={s.send_invoice_email} onChange={(v) => set('send_invoice_email', v)} label={s.send_invoice_email ? 'Send invoices automatically' : 'Do not send invoices automatically'} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email subject" hint="{order_no} and {shop_name} are filled in. Blank = a simple default."><input className={A_INPUT} value={text('invoice_subject')} onChange={(e) => set('invoice_subject', e.target.value)} placeholder="Your invoice - order {order_no}" /></Field>
            <Field label="Website address used in the email link" hint="so the customer can open the order / download the e-book"><input className={A_INPUT} value={text('public_site_url')} onChange={(e) => set('public_site_url', e.target.value)} placeholder="https://yourwebsite.com" /></Field>
            <Field label="Opening words of the email" className="sm:col-span-2" hint="Blank = a simple default."><textarea className={A_INPUT} rows={2} value={text('invoice_message')} onChange={(e) => set('invoice_message', e.target.value)} /></Field>
            <Field label="Your business details on the invoice" className="sm:col-span-2" hint="e.g. business name, address, GSTIN / PAN, as you want them printed at the bottom"><textarea className={A_INPUT} rows={3} value={text('invoice_details')} onChange={(e) => set('invoice_details', e.target.value)} /></Field>
          </div>
        </div>
      </Card>

      <Card title="🚚 Shipping" subtitle="Applied only when the cart has a physical book.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Shipping fee" hint="0 = free"><input className={A_INPUT} type="number" min={0} value={s.shipping_fee} onChange={(e) => set('shipping_fee', Number(e.target.value))} /></Field>
          <Field label="Free shipping above" hint="blank = never free"><input className={A_INPUT} type="number" min={0} value={s.free_shipping_above ?? ''} onChange={(e) => set('free_shipping_above', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label="Currency symbol"><input className={A_INPUT} value={s.currency_symbol} maxLength={4} onChange={(e) => set('currency_symbol', e.target.value)} /></Field>
          <Field label="Shipping note on the book page" className="sm:col-span-3" hint="e.g. delivery time, where you ship"><input className={A_INPUT} value={text('shipping_note')} onChange={(e) => set('shipping_note', e.target.value)} /></Field>
        </div>
      </Card>

      <Card title="📞 Contact details" subtitle="Shown in the shop's footer so customers can reach you.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="WhatsApp number" hint="with country code, digits only"><input className={A_INPUT} value={text('whatsapp_number')} onChange={(e) => set('whatsapp_number', e.target.value)} placeholder="91XXXXXXXXXX" /></Field>
          <Field label="Phone"><input className={A_INPUT} value={text('support_phone')} onChange={(e) => set('support_phone', e.target.value)} /></Field>
          <Field label="Email"><input className={A_INPUT} type="email" value={text('contact_email')} onChange={(e) => set('contact_email', e.target.value)} /></Field>
        </div>
      </Card>

      <Card title="📝 Messages and policies">
        <div className="grid gap-4">
          <Field label="Thank-you message" hint="shown to the customer once the payment is confirmed"><textarea className={A_INPUT} rows={2} value={text('thank_you_note')} onChange={(e) => set('thank_you_note', e.target.value)} /></Field>
          <Field label="Shipping, refund and other policies" hint="shown at the bottom of every shop page"><textarea className={A_INPUT} rows={4} value={text('policy_text')} onChange={(e) => set('policy_text', e.target.value)} /></Field>
        </div>
      </Card>

      <Card title="⚙️ Order options">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Order number starts with" hint="e.g. BK gives BK1001, BK1002…"><input className={A_INPUT} value={s.order_prefix} maxLength={8} onChange={(e) => set('order_prefix', e.target.value)} /></Field>
          <Field label="E-book downloads allowed per purchase" hint="blank = unlimited"><input className={A_INPUT} type="number" min={1} value={s.ebook_download_limit ?? ''} onChange={(e) => set('ebook_download_limit', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label="Country code for customers' numbers" hint="used by the WhatsApp button in Orders"><input className={A_INPUT} value={s.phone_country_code} maxLength={4} onChange={(e) => set('phone_country_code', e.target.value)} /></Field>
        </div>
      </Card>

      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div><button onClick={() => void save()} disabled={saving} className={A_BTN}>{saving ? 'Saving…' : '💾 Save settings'}</button></div>
    </div>
  );
}
