// One order: where it stands (placed -> payment -> confirmed -> shipped -> delivered), how to pay (UPI app button, a QR with the exact
// amount, the UPI id), a form for the UTR / screenshot, the e-book downloads once the payment is confirmed, and the tracking details.
// Opened with the order number; the secret code kept in this browser (or the phone number used) proves it is the customer's own.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import {
  cancelShopOrder, downloadEbook, formatMoney, getShopOrder, secretFor, submitShopPayment, upiLink, uploadPaymentProof, rememberOrder,
} from '../../services/shop/shopService';
import type { OrderStatus, OrderView } from '../../services/shop/shopService';
import { useShop } from './ShopContext';
import { BTN_DARK, BTN_LIGHT, BTN_PRIMARY, Cover, FIELD, FormatBadge } from './ShopBits';

const STEPS: { key: string; label: string }[] = [
  { key: 'placed', label: 'Order placed' },
  { key: 'payment', label: 'Payment' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

function stepIndex(status: OrderStatus, hasPhysical: boolean): number {
  if (status === 'awaiting_payment') return 1;
  if (status === 'payment_submitted') return 1;
  if (status === 'paid') return hasPhysical ? 2 : 4;
  if (status === 'shipped') return 3;
  if (status === 'delivered') return 4;
  return 0;
}

function QrImage({ text }: { text: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let cancelled = false;
    import('qrcode').then((m) => m.toDataURL(text, { margin: 1, width: 360, errorCorrectionLevel: 'M' })).then((u) => { if (!cancelled) setSrc(u); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [text]);
  return src
    ? <img src={src} alt="UPI QR code" className="h-56 w-56 rounded-xl bg-white p-2 shadow ring-1 ring-slate-200" />
    : <div className="h-56 w-56 animate-pulse rounded-xl bg-slate-100" />;
}

export default function ShopOrderPage() {
  const { orderNo = '' } = useParams<{ orderNo: string }>();
  const { info, symbol } = useShop();
  const [order, setOrder] = useState<OrderView | null | undefined>(undefined);
  const [secret, setSecret] = useState<string>(() => secretFor(orderNo) ?? '');
  const [phoneInput, setPhoneInput] = useState('');
  const [error, setError] = useState('');
  const [utr, setUtr] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState('');
  const [dlBusy, setDlBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (quiet = false) => {
    if (!secret) { setOrder(null); return; }
    try {
      const o = await getShopOrder(orderNo, secret);
      setOrder(o);
      if (o) rememberOrder({ order_no: o.order_no, token: secretFor(o.order_no) ?? secret, total: o.total, created_at: o.created_at });
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : 'The order could not be loaded.');
    }
  }, [orderNo, secret]);

  useEffect(() => { void load(); }, [load]);
  // while the customer waits, the page keeps itself up to date
  useEffect(() => {
    if (!order || !['awaiting_payment', 'payment_submitted', 'paid', 'shipped'].includes(order.status)) return;
    const t = setInterval(() => { void load(true); }, 15000);
    return () => clearInterval(t);
  }, [order?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  function copy(text: string, what: string) {
    void navigator.clipboard?.writeText(text).then(() => { setCopied(what); setTimeout(() => setCopied(''), 1800); });
  }

  async function sendPayment() {
    if (!order) return;
    setError(''); setMessage('');
    setBusy(true);
    try {
      const path = proof ? await uploadPaymentProof(proof) : null;
      await submitShopPayment(order.order_no, secret, utr.trim(), path);
      setMessage('Thank you! We have your payment details. We will confirm your order shortly.');
      setUtr(''); setProof(null);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The details could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!order || !window.confirm('Cancel this order?')) return;
    setBusy(true); setError('');
    try { await cancelShopOrder(order.order_no, secret); await load(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'The order could not be cancelled.'); }
    finally { setBusy(false); }
  }

  async function download(itemId: string) {
    if (!order) return;
    setDlBusy(itemId); setError('');
    try { await downloadEbook(order.order_no, secret, itemId); setTimeout(() => void load(true), 2500); }
    catch (e) { setError(e instanceof Error ? e.message : 'The download could not be started.'); }
    finally { setDlBusy(null); }
  }

  // ── opened without the secret: ask for the phone number used ──
  if (order === null || (order === undefined && !secret)) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-lg font-extrabold text-slate-900">Order {orderNo}</h1>
        <p className="text-sm text-slate-600">To see this order, enter the mobile number you gave when you ordered.</p>
        <input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} inputMode="tel" placeholder="Mobile number" className={FIELD} />
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <button className={`${BTN_DARK} w-full`} disabled={phoneInput.replace(/\D/g, '').length < 10} onClick={() => { setSecret(phoneInput.trim()); setOrder(undefined); setError(''); }}>Show my order</button>
        {secret && <p className="text-xs text-red-600">We could not find that order with that number.</p>}
        <Link to={ROUTES.SHOP_ORDERS} className="block text-center text-sm font-semibold text-indigo-600 hover:underline">← My orders</Link>
      </div>
    );
  }
  if (order === undefined) return <div className="mx-auto h-64 max-w-3xl animate-pulse rounded-2xl bg-white" />;

  const cancelled = order.status === 'cancelled';
  const toPay = order.status === 'awaiting_payment' || order.status === 'payment_submitted';
  const step = stepIndex(order.status, order.has_physical);
  const wa = (info?.whatsapp_number ?? '').replace(/\D/g, '');
  const link = info?.upi_id ? upiLink(info, order.total, order.order_no) : '';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to={ROUTES.SHOP_ORDERS} className="inline-block text-sm font-semibold text-indigo-600 hover:underline">← My orders</Link>

      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#14264d] to-[#0e1c3d] p-5 text-white shadow">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Order number</p>
          <h1 className="text-2xl font-black">{order.order_no}</h1>
          <p className="mt-0.5 text-xs text-slate-300">{new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-300">Total</p>
          <p className="text-2xl font-black text-amber-300">{formatMoney(order.total, symbol)}</p>
        </div>
      </header>

      {cancelled ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
          <p className="font-extrabold">This order was cancelled.</p>
          {order.admin_note && <p className="mt-1 text-sm">{order.admin_note}</p>}
          <Link to={ROUTES.SHOP} className={`${BTN_PRIMARY} mt-3`}>Back to the shop</Link>
        </div>
      ) : (
        <ol className="grid gap-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200" style={{ gridTemplateColumns: `repeat(${order.has_physical ? 5 : 3}, minmax(0, 1fr))` }}>
          {STEPS.filter((s) => order.has_physical || (s.key !== 'shipped' && s.key !== 'delivered')).map((s, i) => {
            const idx = STEPS.findIndex((x) => x.key === s.key);
            const finished = order.status === 'delivered' || (order.status === 'paid' && !order.has_physical);
            const done = idx < step || finished;
            const current = idx === step && !finished;
            return (
              <li key={s.key} className="flex flex-col items-center text-center">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${done ? 'bg-emerald-500 text-white' : current ? 'bg-amber-400 text-slate-900 ring-4 ring-amber-100' : 'bg-slate-200 text-slate-500'}`}>{done ? '✓' : i + 1}</span>
                <span className={`mt-1 text-[11px] font-bold leading-tight ${current || done ? 'text-slate-800' : 'text-slate-400'}`}>{s.label}</span>
              </li>
            );
          })}
        </ol>
      )}

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      {message && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</p>}

      {/* ── pay ── */}
      {!cancelled && toPay && (
        <section className="space-y-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {order.status === 'payment_submitted' ? (
            <div className="rounded-xl bg-amber-50 p-4 text-amber-900">
              <p className="font-extrabold">⏳ Waiting for confirmation</p>
              <p className="mt-1 text-sm">We have your UTR <b>{order.payment_utr}</b>. Your order is confirmed as soon as we see the payment. This page updates by itself.</p>
            </div>
          ) : order.admin_note ? (
            <div className="rounded-xl bg-red-50 p-4 text-red-800">
              <p className="font-extrabold">We could not find your payment</p>
              <p className="mt-1 text-sm">{order.admin_note}</p>
            </div>
          ) : null}

          {info?.accept_upi && info.upi_id ? (
            <>
              <h2 className="text-lg font-extrabold text-slate-900">Pay {formatMoney(order.total, symbol)} by UPI</h2>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-700">📱 On your phone</p>
                  <a href={link} className={`${BTN_PRIMARY} w-full !py-3.5 text-base`}>Pay with a UPI app</a>
                  <p className="text-xs text-slate-500">Opens GPay, PhonePe, Paytm or any UPI app with the amount already filled in.</p>
                  <div className="rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="text-xs font-bold text-slate-500">UPI ID</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="break-all font-bold text-slate-900">{info.upi_id}</span>
                      <button onClick={() => copy(info.upi_id as string, 'upi')} className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-indigo-600 ring-1 ring-slate-200">{copied === 'upi' ? 'Copied ✓' : 'Copy'}</button>
                    </div>
                    {info.upi_payee_name && <p className="mt-1 text-xs text-slate-500">Name: {info.upi_payee_name}</p>}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <p className="self-start text-sm font-bold text-slate-700 sm:self-center">📷 Or scan this QR</p>
                  <QrImage text={link} />
                  <p className="text-center text-xs text-slate-500">Scan with any UPI app — the amount {formatMoney(order.total, symbol)} comes filled in.</p>
                  {info.upi_qr_url && (
                    <details className="mt-1 w-full text-center">
                      <summary className="cursor-pointer text-xs font-semibold text-indigo-600">Show the shop's own QR instead</summary>
                      <img src={info.upi_qr_url} alt="Shop QR" className="mx-auto mt-2 h-56 w-56 rounded-xl object-contain ring-1 ring-slate-200" />
                      <p className="mt-1 text-[11px] text-slate-500">If you use this one, please type {formatMoney(order.total, symbol)} yourself.</p>
                    </details>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-4">
                <h3 className="text-base font-extrabold text-slate-900">✅ Paid? Tell us the transaction id</h3>
                <p className="text-xs text-slate-600">After paying, your UPI app shows a <b>UTR / transaction id</b> (12 digits, or letters and numbers). Type it here. A screenshot is optional but speeds things up.</p>
                <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="UTR / transaction id" className={FIELD} />
                <div className="flex flex-wrap items-center gap-3">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
                  <button onClick={() => fileRef.current?.click()} className={BTN_LIGHT}>📎 {proof ? 'Change screenshot' : 'Add payment screenshot'}</button>
                  {proof && <span className="max-w-[12rem] truncate text-xs text-slate-600">{proof.name}</span>}
                </div>
                <button onClick={() => void sendPayment()} disabled={busy || utr.trim().length < 6} className={`${BTN_DARK} w-full`}>{busy ? 'Sending…' : order.status === 'payment_submitted' ? 'Send again' : 'I have paid — send details'}</button>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">Payment details are not set up yet. Please contact the shop{wa ? ` on WhatsApp +${wa}` : ''}.</p>
          )}

          {order.status === 'awaiting_payment' && (
            <button onClick={() => void cancel()} disabled={busy} className="text-xs font-semibold text-slate-400 hover:text-red-500">Cancel this order</button>
          )}
        </section>
      )}

      {/* ── paid: downloads / tracking ── */}
      {!cancelled && !toPay && (
        <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-lg font-extrabold text-emerald-900">✅ Payment confirmed — thank you!</p>
          {info?.thank_you_note && <p className="whitespace-pre-line text-sm text-emerald-900">{info.thank_you_note}</p>}
          {order.has_physical && (
            <div className="rounded-xl bg-white p-4 text-sm text-slate-700">
              {order.status === 'paid' && <p>📦 Your book is being packed. We will add the courier details here as soon as it is shipped.</p>}
              {order.status === 'shipped' && <p>🚚 <b>Shipped</b>{order.courier ? <> by <b>{order.courier}</b></> : null}{order.tracking_no ? <> · Tracking no: <b>{order.tracking_no}</b> <button onClick={() => copy(order.tracking_no as string, 'trk')} className="ml-1 text-xs font-bold text-indigo-600">{copied === 'trk' ? 'Copied ✓' : 'Copy'}</button></> : null}</p>}
              {order.status === 'delivered' && <p>🎉 Delivered. We hope you enjoy it!</p>}
              {order.admin_note && <p className="mt-1 text-xs text-slate-500">{order.admin_note}</p>}
            </div>
          )}
        </section>
      )}

      {/* ── items ── */}
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-extrabold text-slate-900">Items</h2>
        <ul className="space-y-4">
          {order.items.map((it) => (
            <li key={it.id} className="flex gap-3">
              <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100"><Cover src={it.image} title={it.title} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">{it.title}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500"><FormatBadge format={it.format} /> × {it.qty}</div>
                {it.format === 'ebook' && !cancelled && !toPay && (
                  <div className="mt-2">
                    {it.can_download
                      ? <button onClick={() => void download(it.id)} disabled={dlBusy === it.id} className={`${BTN_PRIMARY} !py-2`}>{dlBusy === it.id ? 'Preparing…' : '⬇ Download e-book'}</button>
                      : <p className="text-xs font-semibold text-red-600">The download limit is over. Please contact the shop.</p>}
                    {it.downloads_left != null && it.can_download && <p className="mt-1 text-[11px] text-slate-500">{it.downloads_left} download{it.downloads_left === 1 ? '' : 's'} left</p>}
                  </div>
                )}
                {it.format === 'ebook' && toPay && !cancelled && <p className="mt-1 text-xs text-slate-500">Your download opens after the payment is confirmed.</p>}
              </div>
              <p className="text-sm font-bold text-slate-800">{formatMoney(it.line_total, symbol)}</p>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd>{formatMoney(order.subtotal, symbol)}</dd></div>
          {order.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Coupon {order.coupon_code}</dt><dd>− {formatMoney(order.discount, symbol)}</dd></div>}
          {order.has_physical && <div className="flex justify-between"><dt className="text-slate-600">Shipping</dt><dd>{order.shipping > 0 ? formatMoney(order.shipping, symbol) : 'Free'}</dd></div>}
          <div className="flex justify-between text-base font-extrabold"><dt>Total</dt><dd>{formatMoney(order.total, symbol)}</dd></div>
        </dl>
        {order.has_physical && order.ship_address && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            <p className="text-xs font-bold text-slate-500">Delivering to</p>
            <p className="font-semibold text-slate-800">{order.customer_name}</p>
            <p>{order.ship_address}, {order.ship_city}, {order.ship_state} - {order.ship_pincode}</p>
            <p>📞 {order.phone}</p>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link to={ROUTES.SHOP} className="font-semibold text-indigo-600 hover:underline">← Continue shopping</Link>
        {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hello, about my order ${order.order_no}`)}`} target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 hover:underline">💬 Need help? WhatsApp us</a>}
      </div>
    </div>
  );
}
