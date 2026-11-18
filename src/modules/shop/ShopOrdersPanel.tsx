// The owner's orders: who bought what, whether the UPI payment arrived, and the steps after it - confirm the payment, ship (courier and
// tracking number), deliver, or cancel. The customer's page updates by itself after every step.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadAdminOrders, proofUrl, sendOrderInvoice, setOrderStatus } from '../../services/shop/shopAdminService';
import type { AdminOrder } from '../../services/shop/shopAdminService';
import type { OrderStatus } from '../../services/shop/shopService';
import { A_BTN, A_BTN_DANGER, A_BTN_GOLD, A_BTN_LIGHT, A_INPUT, Notice, money } from './shopAdminUi';

type FilterKey = 'all' | 'check' | 'unpaid' | 'ship' | 'shipped' | 'done' | 'cancelled';

const FILTERS: { key: FilterKey; label: string; test: (o: AdminOrder) => boolean }[] = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'check', label: '⏳ Payment to check', test: (o) => o.status === 'payment_submitted' },
  { key: 'unpaid', label: '💤 Not paid yet', test: (o) => o.status === 'awaiting_payment' },
  { key: 'ship', label: '📦 To ship', test: (o) => o.status === 'paid' && o.has_physical },
  { key: 'shipped', label: '🚚 Shipped', test: (o) => o.status === 'shipped' },
  { key: 'done', label: '✅ Completed', test: (o) => o.status === 'delivered' || (o.status === 'paid' && !o.has_physical) },
  { key: 'cancelled', label: '❌ Cancelled', test: (o) => o.status === 'cancelled' },
];

const BADGE: Record<OrderStatus, { text: string; cls: string }> = {
  awaiting_payment: { text: 'Not paid yet', cls: 'bg-slate-100 text-slate-700' },
  payment_submitted: { text: 'Check payment', cls: 'bg-amber-100 text-amber-800' },
  paid: { text: 'Paid', cls: 'bg-emerald-100 text-emerald-800' },
  shipped: { text: 'Shipped', cls: 'bg-indigo-100 text-indigo-800' },
  delivered: { text: 'Delivered', cls: 'bg-emerald-100 text-emerald-800' },
  cancelled: { text: 'Cancelled', cls: 'bg-red-100 text-red-700' },
};

function csvCell(v: unknown): string { return `"${String(v ?? '').replace(/"/g, '""')}"`; }

function OrderCard({ o, symbol, countryCode, onChanged }: { o: AdminOrder; symbol: string; countryCode: string; onChanged: () => void }) {
  const [open, setOpen] = useState(o.status === 'payment_submitted');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [courier, setCourier] = useState(o.courier ?? '');
  const [tracking, setTracking] = useState(o.tracking_no ?? '');
  const [proof, setProof] = useState<string | null>(null);
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (open && o.payment_proof_path && !proof) void proofUrl(o.payment_proof_path).then(setProof);
  }, [open, o.payment_proof_path, proof]);

  async function act(status: OrderStatus, opts: { courier?: string; tracking?: string; note?: string } = {}, ask?: string) {
    if (ask && !window.confirm(ask)) return;
    setBusy(true); setErr('');
    try {
      await setOrderStatus(o.id, status, opts);
      // confirming a payment by hand also sends the invoice (when switched on in Settings and the customer gave an email)
      if (status === 'paid' && o.email) {
        const r = await sendOrderInvoice(o.id);
        setInfo(r.sent ? '✉ Invoice emailed to the customer.' : r.message);
      }
      onChanged();
    }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not change the order.'); }
    finally { setBusy(false); }
  }

  async function sendInvoice() {
    setBusy(true); setErr(''); setInfo('');
    const r = await sendOrderInvoice(o.id);
    if (r.sent) { setInfo('✉ ' + r.message); onChanged(); } else setErr(r.message);
    setBusy(false);
  }

  const digits = o.phone.replace(/\D/g, '');
  const wa = `https://wa.me/${digits.length === 10 ? countryCode + digits : digits}?text=${encodeURIComponent(
    o.status === 'shipped' ? `Hello ${o.customer_name}, your order ${o.order_no} has been shipped${o.courier ? ` by ${o.courier}` : ''}${o.tracking_no ? ` (tracking no ${o.tracking_no})` : ''}.`
      : o.status === 'paid' ? `Hello ${o.customer_name}, we have received your payment for order ${o.order_no}. Thank you!`
      : `Hello ${o.customer_name}, regarding your order ${o.order_no}.`)}`;

  const b = BADGE[o.status];
  return (
    <article className={`rounded-2xl bg-white shadow-sm ring-1 ${o.status === 'payment_submitted' ? 'ring-amber-300' : 'ring-slate-200'}`}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left">
        <div className="min-w-0">
          <p className="font-extrabold text-slate-900">{o.order_no} <span className="ml-1 text-sm font-semibold text-slate-500">· {o.customer_name}</span></p>
          <p className="text-xs text-slate-500">
            {new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {o.shop_order_items.map((i) => `${i.title}${i.qty > 1 ? ` ×${i.qty}` : ''} (${i.format === 'ebook' ? 'e-book' : 'book'})`).join(', ')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base font-extrabold text-slate-900">{money(o.total, symbol)}</span>
          {o.payment_method === 'razorpay' && ['paid', 'shipped', 'delivered'].includes(o.status) && <span className="hidden rounded-full bg-sky-100 px-2 py-1 text-[11px] font-bold text-sky-700 sm:inline">💳 Online</span>}
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${b.cls}`}>{b.text}</span>
          <span className="text-slate-400">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 text-sm text-slate-700">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Customer</p>
              <p className="font-semibold">{o.customer_name}</p>
              <p>📞 <a className="text-indigo-600 hover:underline" href={`tel:${o.phone}`}>{o.phone}</a> · <a className="font-semibold text-emerald-700 hover:underline" href={wa} target="_blank" rel="noreferrer">💬 WhatsApp</a></p>
              {o.email && <p>✉️ {o.email}</p>}
              {o.has_physical && <p className="mt-2 rounded-lg bg-slate-50 p-2.5">📍 {o.ship_address}, {o.ship_city}, {o.ship_state} - {o.ship_pincode}</p>}
              {o.customer_note && <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-amber-900">💬 “{o.customer_note}”</p>}
            </div>
            <div className="space-y-1 text-sm text-slate-700">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Bill</p>
              {o.shop_order_items.map((i) => (
                <p key={i.id} className="flex justify-between gap-3"><span>{i.title} <span className="text-slate-400">({i.format === 'ebook' ? 'e-book' : 'book'}) ×{i.qty}</span></span><span className="font-semibold">{money(i.line_total, symbol)}</span></p>
              ))}
              {o.discount > 0 && <p className="flex justify-between text-emerald-700"><span>Coupon {o.coupon_code}</span><span>− {money(o.discount, symbol)}</span></p>}
              {o.has_physical && <p className="flex justify-between"><span>Shipping</span><span>{o.shipping > 0 ? money(o.shipping, symbol) : 'Free'}</span></p>}
              <p className="flex justify-between border-t border-slate-200 pt-1 font-extrabold"><span>Total to receive</span><span>{money(o.total, symbol)}</span></p>
            </div>
          </div>

          {o.payment_method === 'razorpay' && o.razorpay_payment_id && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Paid online (Razorpay)</p>
              <p className="mt-1">Payment id: <span className="select-all font-mono font-extrabold text-slate-900">{o.razorpay_payment_id}</span></p>
              <p className="mt-1 text-xs text-slate-600">The money reached your Razorpay account. To refund, use the Razorpay dashboard.</p>
            </div>
          )}

          {(o.payment_utr || proof) && o.payment_method !== 'razorpay' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Payment details from the customer</p>
              <div className="mt-1 flex flex-wrap items-center gap-4">
                {o.payment_utr && <p>UTR: <span className="select-all font-mono font-extrabold text-slate-900">{o.payment_utr}</span></p>}
                {o.payment_submitted_at && <p className="text-xs text-slate-500">sent {new Date(o.payment_submitted_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
                {proof && <a href={proof} target="_blank" rel="noreferrer"><img src={proof} alt="Payment screenshot" className="h-24 rounded-lg ring-1 ring-slate-300" /></a>}
              </div>
              <p className="mt-2 text-xs text-slate-600">Open your UPI app / bank statement and check that {money(o.total, symbol)} reached you with this UTR, then confirm below.</p>
            </div>
          )}

          {err && <Notice kind="error">{err}</Notice>}
          {info && <Notice kind="ok">{info}</Notice>}

          {/* what can be done now */}
          <div className="space-y-3">
            {o.status === 'payment_submitted' && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy} onClick={() => void act('paid')} className={A_BTN}>✓ Payment received — confirm order</button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input className={`${A_INPUT} max-w-xs`} placeholder="Reason, e.g. amount did not reach me" value={note} onChange={(e) => setNote(e.target.value)} />
                  <button disabled={busy} onClick={() => void act('awaiting_payment', { note }, 'Tell the customer the payment was not found? They can send the right UTR again.')} className={A_BTN_LIGHT}>✕ Not received — ask again</button>
                </div>
              </div>
            )}
            {o.status === 'awaiting_payment' && (
              <button disabled={busy} onClick={() => void act('paid', {}, 'Mark this order as paid (for example you received the money in another way)?')} className={A_BTN_LIGHT}>Mark as paid myself</button>
            )}
            {(o.status === 'paid' || o.status === 'shipped') && o.has_physical && (
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{o.status === 'paid' ? 'Ship the book' : 'Shipping details'}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input className={A_INPUT} placeholder="Courier (e.g. DTDC, India Post)" value={courier} onChange={(e) => setCourier(e.target.value)} />
                  <input className={A_INPUT} placeholder="Tracking / consignment number" value={tracking} onChange={(e) => setTracking(e.target.value)} />
                  <button disabled={busy} onClick={() => void act('shipped', { courier, tracking })} className={A_BTN_GOLD}>🚚 {o.status === 'paid' ? 'Mark as shipped' : 'Update details'}</button>
                </div>
              </div>
            )}
            {(o.status === 'shipped' || (o.status === 'paid' && o.has_physical)) && (
              <button disabled={busy} onClick={() => void act('delivered')} className={A_BTN_LIGHT}>📦 Mark as delivered</button>
            )}
            {o.status === 'paid' && !o.has_physical && <p className="text-sm font-semibold text-emerald-700">✓ E-book order — the customer can download it now. Nothing more to do.</p>}
            {o.has_ebook && ['paid', 'shipped', 'delivered'].includes(o.status) && (
              <p className="text-xs text-slate-500">Downloads so far: {o.shop_order_items.filter((i) => i.format === 'ebook').map((i) => `${i.title} — ${i.download_count}`).join(' · ')}</p>
            )}
            {o.admin_note && <p className="rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-900">📝 {o.admin_note}</p>}
            {['paid', 'shipped', 'delivered'].includes(o.status) && o.email && (
              <div className="flex flex-wrap items-center gap-3">
                <button disabled={busy} onClick={() => void sendInvoice()} className={A_BTN_LIGHT}>✉ {o.invoice_sent_at ? 'Send invoice again' : 'Send invoice'}</button>
                <span className="text-xs text-slate-500">{o.invoice_sent_at ? `Last sent ${new Date(o.invoice_sent_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Not sent yet'}</span>
              </div>
            )}
            {o.status !== 'cancelled' && o.status !== 'delivered' && (
              <button disabled={busy} onClick={() => void act('cancelled', { note }, o.payment_method === 'razorpay' && o.razorpay_payment_id ? 'This order was paid online. Cancel it here AND refund the money in the Razorpay dashboard. Cancel now? (The stock goes back and the coupon use is given back.)' : 'Cancel this order? The stock goes back and the coupon use is given back.')} className={A_BTN_DANGER}>Cancel order</button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export default function ShopOrdersPanel({ symbol, countryCode, onCount }: { symbol: string; countryCode: string; onCount: (toCheck: number) => void }) {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    loadAdminOrders()
      .then((o) => { setOrders(o); setError(''); onCount(o.filter((x) => x.status === 'payment_submitted').length); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the orders.'));
  }, [onCount]);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, (orders ?? []).filter(f.test).length])) as Record<FilterKey, number>, [orders]);
  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const q = query.trim().toLowerCase();
    return (orders ?? []).filter((o) => f.test(o) && (!q || `${o.order_no} ${o.customer_name} ${o.phone} ${o.email ?? ''} ${o.payment_utr ?? ''}`.toLowerCase().includes(q)));
  }, [orders, filter, query]);

  function exportCsv() {
    const head = ['Order', 'Date', 'Status', 'Customer', 'Phone', 'Email', 'Items', 'Subtotal', 'Discount', 'Coupon', 'Shipping', 'Total', 'UTR', 'Address', 'Courier', 'Tracking'];
    const rows = shown.map((o) => [
      o.order_no, new Date(o.created_at).toLocaleString('en-IN'), BADGE[o.status].text, o.customer_name, o.phone, o.email,
      o.shop_order_items.map((i) => `${i.title} x${i.qty} (${i.format})`).join('; '), o.subtotal, o.discount, o.coupon_code, o.shipping, o.total,
      o.payment_utr, o.has_physical ? `${o.ship_address}, ${o.ship_city}, ${o.ship_state} ${o.ship_pincode}` : '', o.courier, o.tracking_no,
    ]);
    const csv = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `shop-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition ${filter === f.key ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {f.label} <span className={filter === f.key ? 'opacity-80' : 'opacity-50'}>{counts[f.key]}</span>
            {f.key === 'check' && counts.check > 0 && filter !== 'check' && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-red-500" />}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 Search order no, name, phone, UTR…" className={`${A_INPUT} max-w-sm`} />
        <button onClick={load} className={A_BTN_LIGHT}>↻ Refresh</button>
        <button onClick={exportCsv} disabled={shown.length === 0} className={A_BTN_LIGHT}>⬇ Download list (CSV)</button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {orders && shown.length === 0 && <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">{orders.length === 0 ? 'No orders yet. They appear here as soon as a customer orders.' : 'No order in this list.'}</div>}
      <div className="space-y-3">
        {shown.map((o) => <OrderCard key={o.id} o={o} symbol={symbol} countryCode={countryCode} onChanged={load} />)}
      </div>
    </div>
  );
}
