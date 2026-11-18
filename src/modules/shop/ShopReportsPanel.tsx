// Shop reports: a summary (sales, orders, pending payments), a sales chart, and detailed reports for orders, payments, books,
// coupons, customers and shipping. Pick a date range (by the day the order was placed); every table can be downloaded as CSV.
// Everything is worked out from the orders themselves - nothing is typed in by hand.

import { useEffect, useMemo, useState } from 'react';
import { loadAdminOrders, loadAdminProducts } from '../../services/shop/shopAdminService';
import type { AdminOrder, AdminProduct } from '../../services/shop/shopAdminService';
import { A_BTN_LIGHT, A_INPUT, Card, Notice, money } from './shopAdminUi';

type Preset = 'today' | '7d' | '30d' | 'month' | 'lastmonth' | 'year' | 'all' | 'custom';
type Section = 'summary' | 'orders' | 'payments' | 'books' | 'coupons' | 'customers' | 'shipping';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Today' }, { key: '7d', label: 'Last 7 days' }, { key: '30d', label: 'Last 30 days' }, { key: 'month', label: 'This month' },
  { key: 'lastmonth', label: 'Last month' }, { key: 'year', label: 'This year' }, { key: 'all', label: 'All time' }, { key: 'custom', label: 'Custom' },
];
const SECTIONS: { key: Section; label: string }[] = [
  { key: 'summary', label: '📊 Summary' }, { key: 'orders', label: '🧾 Orders' }, { key: 'payments', label: '💳 Payments' }, { key: 'books', label: '📚 Books sold' },
  { key: 'coupons', label: '🏷 Coupons' }, { key: 'customers', label: '👥 Customers' }, { key: 'shipping', label: '🚚 Shipping & delivery' },
];

const PAID = ['paid', 'shipped', 'delivered'];
const isPaid = (o: AdminOrder) => PAID.includes(o.status);
const STATUS_TEXT: Record<string, string> = { awaiting_payment: 'Not paid yet', payment_submitted: 'Payment to check', paid: 'Paid', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
const METHOD_TEXT = (o: AdminOrder) => (o.total <= 0 ? 'Free (full discount)' : o.payment_method === 'razorpay' ? 'Online (Razorpay)' : 'UPI / QR');

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const digits = (p: string) => p.replace(/\D/g, '').slice(-10);

function rangeFor(preset: Preset, from: string, to: string): { start: Date | null; end: Date | null } {
  const today = startOfDay(new Date());
  switch (preset) {
    case 'today': return { start: today, end: addDays(today, 1) };
    case '7d': return { start: addDays(today, -6), end: addDays(today, 1) };
    case '30d': return { start: addDays(today, -29), end: addDays(today, 1) };
    case 'month': return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: addDays(today, 1) };
    case 'lastmonth': return { start: new Date(today.getFullYear(), today.getMonth() - 1, 1), end: new Date(today.getFullYear(), today.getMonth(), 1) };
    case 'year': return { start: new Date(today.getFullYear(), 0, 1), end: addDays(today, 1) };
    case 'custom': return { start: from ? new Date(`${from}T00:00:00`) : null, end: to ? addDays(new Date(`${to}T00:00:00`), 1) : null };
    default: return { start: null, end: null };
  }
}

function csvDownload(name: string, head: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${name}-${ymd(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── small building blocks ──
function Kpi({ label, value, sub, tone = 'slate' }: { label: string; value: string; sub?: string; tone?: 'slate' | 'green' | 'amber' | 'indigo' | 'red' }) {
  const bar = { slate: 'bg-slate-300', green: 'bg-emerald-500', amber: 'bg-amber-400', indigo: 'bg-indigo-500', red: 'bg-red-500' }[tone];
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <span className={`absolute left-0 top-0 h-full w-1 ${bar}`} />
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

interface Col<T> { head: string; cell: (r: T) => string | number; align?: 'right'; csv?: (r: T) => string | number }
function ReportTable<T>({ title, subtitle, cols, rows, file, footer, empty = 'Nothing in this period.' }: {
  title: string; subtitle?: string; cols: Col<T>[]; rows: T[]; file: string; footer?: (string | number)[]; empty?: string;
}) {
  const [limit, setLimit] = useState(50);
  return (
    <Card title={title} subtitle={subtitle} right={<button disabled={rows.length === 0} className={A_BTN_LIGHT} onClick={() => csvDownload(file, cols.map((c) => c.head), rows.map((r) => cols.map((c) => (c.csv ?? c.cell)(r))))}>⬇ CSV</button>}>
      {rows.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">{empty}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">{cols.map((c) => <th key={c.head} className={`px-2 py-2 font-bold ${c.align === 'right' ? 'text-right' : ''}`}>{c.head}</th>)}</tr></thead>
            <tbody>
              {rows.slice(0, limit).map((r, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">{cols.map((c) => <td key={c.head} className={`px-2 py-2 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>{c.cell(r)}</td>)}</tr>
              ))}
            </tbody>
            {footer && <tfoot><tr className="border-t-2 border-slate-300 font-extrabold">{footer.map((f, i) => <td key={i} className={`px-2 py-2 ${cols[i]?.align === 'right' ? 'text-right tabular-nums' : ''}`}>{f}</td>)}</tr></tfoot>}
          </table>
          {rows.length > limit && <button onClick={() => setLimit((l) => l + 100)} className="mt-3 text-sm font-semibold text-indigo-600 hover:underline">Show more ({rows.length - limit} more rows)</button>}
        </div>
      )}
    </Card>
  );
}

/** Sales bars (one per day / week / month depending on the length of the period). */
function SalesChart({ orders, start, end, symbol }: { orders: AdminOrder[]; start: Date | null; end: Date | null; symbol: string }) {
  const data = useMemo(() => {
    const paid = orders.filter(isPaid);
    if (orders.length === 0) return [];
    const first = start ?? startOfDay(new Date(Math.min(...orders.map((o) => +new Date(o.created_at)))));
    const last = end ? addDays(end, -1) : startOfDay(new Date());
    const days = Math.max(1, Math.round((+last - +first) / 86400000) + 1);
    const mode: 'day' | 'week' | 'month' = days <= 62 ? 'day' : days <= 400 ? 'week' : 'month';
    const key = (d: Date) => {
      if (mode === 'day') return ymd(d);
      if (mode === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const s = startOfDay(d); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return ymd(s);   // week starts Monday
    };
    const buckets = new Map<string, { label: string; revenue: number; orders: number }>();
    for (let i = 0; i < days; i++) {
      const d = addDays(first, i);
      const k = key(d);
      if (!buckets.has(k)) buckets.set(k, { label: mode === 'month' ? d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), revenue: 0, orders: 0 });
    }
    for (const o of orders) { const b = buckets.get(key(new Date(o.created_at))); if (b && o.status !== 'cancelled') b.orders += 1; }
    for (const o of paid) { const b = buckets.get(key(new Date(o.created_at))); if (b) b.revenue += o.total; }
    return [...buckets.values()];
  }, [orders, start, end]);

  if (data.length === 0) return <p className="py-8 text-center text-sm text-slate-400">No orders in this period.</p>;
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const W = 720, H = 220, padL = 8, padB = 28, padT = 12;
  const bw = Math.min(40, (W - padL * 2) / data.length - 4);
  const step = (W - padL * 2) / data.length;
  const every = Math.ceil(data.length / 10);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Sales by period">
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={padL} x2={W - padL} y1={padT + (H - padT - padB) * (1 - f)} y2={padT + (H - padT - padB) * (1 - f)} stroke="#e2e8f0" strokeWidth="1" />)}
        {data.map((d, i) => {
          const h = (H - padT - padB) * (d.revenue / max);
          const x = padL + i * step + (step - bw) / 2;
          return (
            <g key={i}>
              <title>{`${d.label}: ${money(d.revenue, symbol)} from paid orders · ${d.orders} order${d.orders === 1 ? '' : 's'} placed`}</title>
              <rect x={x} y={H - padB - h} width={bw} height={Math.max(h, d.revenue > 0 ? 2 : 0)} rx="3" fill={d.revenue > 0 ? '#4f46e5' : '#e2e8f0'} />
              {i % every === 0 && <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-[11px] text-slate-400">Bars show money received from paid orders · hover a bar for the numbers</p>
    </div>
  );
}

export default function ShopReportsPanel({ symbol }: { symbol: string }) {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [error, setError] = useState('');
  const [preset, setPreset] = useState<Preset>('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [section, setSection] = useState<Section>('summary');
  const [statusFilter, setStatusFilter] = useState('all');

  function load() {
    setError('');
    loadAdminOrders().then(setOrders).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the reports.'));
    loadAdminProducts().then(setProducts).catch(() => undefined);
  }
  useEffect(load, []);

  const { start, end } = useMemo(() => rangeFor(preset, from, to), [preset, from, to]);
  const inRange = useMemo(() => (orders ?? []).filter((o) => {
    const t = +new Date(o.created_at);
    return (!start || t >= +start) && (!end || t < +end);
  }), [orders, start, end]);

  const m = useMemo(() => {
    const live = inRange.filter((o) => o.status !== 'cancelled');
    const paid = inRange.filter(isPaid);
    const waiting = inRange.filter((o) => o.status === 'awaiting_payment' || o.status === 'payment_submitted');
    const revenue = paid.reduce((s, o) => s + o.total, 0);
    const sold = { physical: { units: 0, revenue: 0 }, ebook: { units: 0, revenue: 0 } };
    for (const o of paid) for (const i of o.shop_order_items) { sold[i.format].units += i.qty; sold[i.format].revenue += i.line_total; }
    return {
      live, paid, waiting, revenue, sold,
      placed: inRange.length, cancelled: inRange.length - live.length,
      aov: paid.length ? revenue / paid.length : 0,
      discount: live.reduce((s, o) => s + o.discount, 0),
      shipping: paid.reduce((s, o) => s + o.shipping, 0),
      waitingAmount: waiting.reduce((s, o) => s + o.total, 0),
      toCheck: inRange.filter((o) => o.status === 'payment_submitted'),
    };
  }, [inRange]);

  if (error) return <Notice kind="error">{error}</Notice>;
  if (!orders) return <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />;

  const statusCounts = ['awaiting_payment', 'payment_submitted', 'paid', 'shipped', 'delivered', 'cancelled'].map((s) => ({ s, n: inRange.filter((o) => o.status === s).length, amt: inRange.filter((o) => o.status === s).reduce((a, o) => a + o.total, 0) }));
  const maxStatus = Math.max(1, ...statusCounts.map((x) => x.n));

  // books sold (paid orders only), joined with the current stock
  const bookMap = new Map<string, { title: string; format: string; units: number; revenue: number; orders: Set<string>; productId: string | null }>();
  for (const o of m.paid) for (const i of o.shop_order_items) {
    const k = `${i.product_id ?? i.title}|${i.format}`;
    const row = bookMap.get(k) ?? { title: i.title, format: i.format, units: 0, revenue: 0, orders: new Set<string>(), productId: i.product_id };
    row.units += i.qty; row.revenue += i.line_total; row.orders.add(o.id); bookMap.set(k, row);
  }
  const books = [...bookMap.values()].sort((a, b) => b.revenue - a.revenue);

  // coupons
  const couponMap = new Map<string, { code: string; orders: number; discount: number; sales: number }>();
  for (const o of m.live) if (o.coupon_code) {
    const r = couponMap.get(o.coupon_code) ?? { code: o.coupon_code, orders: 0, discount: 0, sales: 0 };
    r.orders += 1; r.discount += o.discount; if (isPaid(o)) r.sales += o.total; couponMap.set(o.coupon_code, r);
  }
  const coupons = [...couponMap.values()].sort((a, b) => b.discount - a.discount);

  // customers (by mobile number)
  const custMap = new Map<string, { name: string; phone: string; email: string; orders: number; spent: number; last: string }>();
  for (const o of m.live) {
    const k = digits(o.phone);
    const r = custMap.get(k) ?? { name: o.customer_name, phone: o.phone, email: o.email ?? '', orders: 0, spent: 0, last: o.created_at };
    r.orders += 1; if (isPaid(o)) r.spent += o.total; if (o.created_at > r.last) { r.last = o.created_at; r.name = o.customer_name; } custMap.set(k, r);
  }
  const customers = [...custMap.values()].sort((a, b) => b.spent - a.spent);
  const repeat = customers.filter((c) => c.orders > 1).length;

  // payments
  const byMethod = new Map<string, { method: string; n: number; amt: number }>();
  for (const o of m.paid) { const k = METHOD_TEXT(o); const r = byMethod.get(k) ?? { method: k, n: 0, amt: 0 }; r.n += 1; r.amt += o.total; byMethod.set(k, r); }
  const hoursSince = (iso: string) => Math.round((Date.now() - +new Date(iso)) / 3600000);

  // shipping
  const physicalPaid = m.paid.filter((o) => o.has_physical);
  const toShip = physicalPaid.filter((o) => o.status === 'paid');
  const shippedRows = physicalPaid.filter((o) => o.status === 'shipped' || o.status === 'delivered');
  const shipDays = shippedRows.filter((o) => o.shipped_at && o.paid_at).map((o) => (+new Date(o.shipped_at as string) - +new Date(o.paid_at as string)) / 86400000);
  const avgShip = shipDays.length ? shipDays.reduce((a, b) => a + b, 0) / shipDays.length : 0;
  const placeMap = new Map<string, { place: string; n: number; amt: number }>();
  for (const o of m.live.filter((x) => x.has_physical)) { const k = `${o.ship_state ?? '—'} · ${o.ship_city ?? '—'}`; const r = placeMap.get(k) ?? { place: k, n: 0, amt: 0 }; r.n += 1; r.amt += o.total; placeMap.set(k, r); }
  const places = [...placeMap.values()].sort((a, b) => b.n - a.n);
  const downloads = m.paid.flatMap((o) => o.shop_order_items.filter((i) => i.format === 'ebook').map((i) => ({ o, i })));

  const ordersShown = statusFilter === 'all' ? inRange : inRange.filter((o) => o.status === statusFilter);

  return (
    <div className="space-y-5">
      {/* period */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => setPreset(p.key)} className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition ${preset === p.key ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{p.label}</button>
          ))}
          {preset === 'custom' && (
            <span className="flex flex-wrap items-center gap-2">
              <input type="date" className={`${A_INPUT} w-auto`} value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-xs text-slate-500">to</span>
              <input type="date" className={`${A_INPUT} w-auto`} value={to} onChange={(e) => setTo(e.target.value)} />
            </span>
          )}
          <button onClick={load} className={`${A_BTN_LIGHT} ml-auto`}>↻ Refresh</button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {start ? start.toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'The beginning'} → {end ? addDays(end, -1).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'today'} · by the day the order was placed · {inRange.length} order{inRange.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <button key={s.key} onClick={() => setSection(s.key)} className={`rounded-xl px-3.5 py-2 text-sm font-bold transition ${section === s.key ? 'bg-[#14264d] text-white shadow' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>{s.label}</button>
        ))}
      </div>

      {section === 'summary' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Money received" value={money(m.revenue, symbol)} sub={`${m.paid.length} paid order${m.paid.length === 1 ? '' : 's'}`} tone="green" />
            <Kpi label="Orders placed" value={String(m.placed)} sub={`${m.cancelled} cancelled`} tone="indigo" />
            <Kpi label="Average order" value={money(m.aov, symbol)} sub="of paid orders" />
            <Kpi label="Waiting for payment" value={money(m.waitingAmount, symbol)} sub={`${m.waiting.length} order${m.waiting.length === 1 ? '' : 's'} · ${m.toCheck.length} to check`} tone={m.toCheck.length ? 'amber' : 'slate'} />
            <Kpi label="Books sold" value={String(m.sold.physical.units)} sub={money(m.sold.physical.revenue, symbol)} />
            <Kpi label="E-books sold" value={String(m.sold.ebook.units)} sub={money(m.sold.ebook.revenue, symbol)} />
            <Kpi label="Discounts given" value={money(m.discount, symbol)} sub="coupons" tone="red" />
            <Kpi label="Shipping collected" value={money(m.shipping, symbol)} />
          </div>
          <Card title="Sales over time"><SalesChart orders={inRange} start={start} end={end} symbol={symbol} /></Card>
          <Card title="Where the orders stand">
            <div className="space-y-2">
              {statusCounts.map(({ s, n, amt }) => (
                <div key={s} className="flex items-center gap-3 text-sm">
                  <span className="w-36 flex-shrink-0 font-semibold text-slate-700">{STATUS_TEXT[s]}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${s === 'cancelled' ? 'bg-red-400' : s === 'awaiting_payment' || s === 'payment_submitted' ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${(n / maxStatus) * 100}%` }} /></div>
                  <span className="w-28 flex-shrink-0 text-right tabular-nums text-slate-700">{n} · {money(amt, symbol)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {section === 'orders' && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-600">Show:</span>
            <select className={`${A_INPUT} w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All orders</option>
              {Object.entries(STATUS_TEXT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <ReportTable
            title="All orders" subtitle="Every order placed in this period." file="shop-orders-report" rows={ordersShown}
            cols={[
              { head: 'Order', cell: (o) => o.order_no },
              { head: 'Placed', cell: (o) => fmtDate(o.created_at) },
              { head: 'Customer', cell: (o) => o.customer_name },
              { head: 'Mobile', cell: (o) => o.phone },
              { head: 'Items', cell: (o) => o.shop_order_items.map((i) => `${i.title}${i.qty > 1 ? ` ×${i.qty}` : ''} (${i.format === 'ebook' ? 'e-book' : 'book'})`).join('; ') },
              { head: 'Subtotal', cell: (o) => money(o.subtotal, symbol), csv: (o) => o.subtotal, align: 'right' },
              { head: 'Discount', cell: (o) => money(o.discount, symbol), csv: (o) => o.discount, align: 'right' },
              { head: 'Shipping', cell: (o) => money(o.shipping, symbol), csv: (o) => o.shipping, align: 'right' },
              { head: 'Total', cell: (o) => money(o.total, symbol), csv: (o) => o.total, align: 'right' },
              { head: 'Status', cell: (o) => STATUS_TEXT[o.status] },
              { head: 'Paid by', cell: (o) => (isPaid(o) ? METHOD_TEXT(o) : '') },
            ]}
            footer={['Total', '', '', '', '', money(ordersShown.reduce((s, o) => s + o.subtotal, 0), symbol), money(ordersShown.reduce((s, o) => s + o.discount, 0), symbol), money(ordersShown.reduce((s, o) => s + o.shipping, 0), symbol), money(ordersShown.reduce((s, o) => s + o.total, 0), symbol), '', '']}
          />
        </>
      )}

      {section === 'payments' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Received" value={money(m.revenue, symbol)} sub={`${m.paid.length} payment${m.paid.length === 1 ? '' : 's'}`} tone="green" />
            {[...byMethod.values()].map((r) => <Kpi key={r.method} label={r.method} value={money(r.amt, symbol)} sub={`${r.n} order${r.n === 1 ? '' : 's'}`} tone="indigo" />)}
            <Kpi label="Waiting / not paid" value={money(m.waitingAmount, symbol)} sub={`${m.waiting.length} order${m.waiting.length === 1 ? '' : 's'}`} tone="amber" />
          </div>
          <ReportTable
            title="Payments received" subtitle="Paid orders with how they were paid." file="shop-payments-received" rows={m.paid}
            cols={[
              { head: 'Order', cell: (o) => o.order_no },
              { head: 'Paid on', cell: (o) => fmtDate(o.paid_at) },
              { head: 'Customer', cell: (o) => o.customer_name },
              { head: 'Paid by', cell: (o) => METHOD_TEXT(o) },
              { head: 'UTR / payment id', cell: (o) => o.razorpay_payment_id || o.payment_utr || '' },
              { head: 'Amount', cell: (o) => money(o.total, symbol), csv: (o) => o.total, align: 'right' },
            ]}
            footer={['Total received', '', '', '', '', money(m.revenue, symbol)]}
          />
          <ReportTable
            title="Payments to check / not paid" subtitle="Orders that are still waiting. The oldest are the ones to chase or cancel." file="shop-payments-pending" rows={[...m.waiting].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))}
            cols={[
              { head: 'Order', cell: (o) => o.order_no },
              { head: 'Placed', cell: (o) => fmtDate(o.created_at) },
              { head: 'Waiting', cell: (o) => `${hoursSince(o.created_at)} h`, csv: (o) => hoursSince(o.created_at) },
              { head: 'Customer', cell: (o) => `${o.customer_name} · ${o.phone}` },
              { head: 'State', cell: (o) => (o.status === 'payment_submitted' ? 'Customer sent UTR — check it' : 'No payment yet') },
              { head: 'UTR', cell: (o) => o.payment_utr ?? '' },
              { head: 'Amount', cell: (o) => money(o.total, symbol), csv: (o) => o.total, align: 'right' },
            ]}
            footer={['Total waiting', '', '', '', '', '', money(m.waitingAmount, symbol)]}
          />
        </>
      )}

      {section === 'books' && (
        <ReportTable
          title="Books sold" subtitle="From paid orders. Stock is today's stock." file="shop-books-sold" rows={books}
          cols={[
            { head: 'Book', cell: (b) => b.title },
            { head: 'Format', cell: (b) => (b.format === 'ebook' ? 'E-book' : 'Book') },
            { head: 'Orders', cell: (b) => b.orders.size, align: 'right' },
            { head: 'Copies sold', cell: (b) => b.units, align: 'right' },
            { head: 'Money', cell: (b) => money(b.revenue, symbol), csv: (b) => b.revenue, align: 'right' },
            { head: 'Stock left', cell: (b) => { const p = products.find((x) => x.id === b.productId); return b.format === 'ebook' ? '—' : p ? (p.physical_stock == null ? 'not counted' : p.physical_stock) : '—'; } },
          ]}
          footer={['Total', '', books.reduce((s, b) => s + b.orders.size, 0), books.reduce((s, b) => s + b.units, 0), money(books.reduce((s, b) => s + b.revenue, 0), symbol), '']}
        />
      )}

      {section === 'coupons' && (
        <ReportTable
          title="Coupon use" subtitle="Orders (not cancelled) that used a coupon." file="shop-coupons-report" rows={coupons} empty="No coupon was used in this period."
          cols={[
            { head: 'Coupon', cell: (c) => c.code },
            { head: 'Orders', cell: (c) => c.orders, align: 'right' },
            { head: 'Discount given', cell: (c) => money(c.discount, symbol), csv: (c) => c.discount, align: 'right' },
            { head: 'Money received from these orders', cell: (c) => money(c.sales, symbol), csv: (c) => c.sales, align: 'right' },
          ]}
          footer={['Total', coupons.reduce((s, c) => s + c.orders, 0), money(coupons.reduce((s, c) => s + c.discount, 0), symbol), money(coupons.reduce((s, c) => s + c.sales, 0), symbol)]}
        />
      )}

      {section === 'customers' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="Customers" value={String(customers.length)} tone="indigo" />
            <Kpi label="Came back again" value={String(repeat)} sub="more than one order" tone="green" />
            <Kpi label="Biggest spender" value={customers[0] ? money(customers[0].spent, symbol) : '—'} sub={customers[0]?.name} />
          </div>
          <ReportTable
            title="Customers" subtitle="Grouped by mobile number, biggest spenders first." file="shop-customers-report" rows={customers}
            cols={[
              { head: 'Customer', cell: (c) => c.name },
              { head: 'Mobile', cell: (c) => c.phone },
              { head: 'Email', cell: (c) => c.email },
              { head: 'Orders', cell: (c) => c.orders, align: 'right' },
              { head: 'Spent (paid)', cell: (c) => money(c.spent, symbol), csv: (c) => c.spent, align: 'right' },
              { head: 'Last order', cell: (c) => fmtDate(c.last) },
            ]}
          />
        </>
      )}

      {section === 'shipping' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="To ship now" value={String(toShip.length)} sub="paid, not shipped" tone={toShip.length ? 'amber' : 'slate'} />
            <Kpi label="Shipped" value={String(physicalPaid.filter((o) => o.status === 'shipped').length)} sub="on the way" tone="indigo" />
            <Kpi label="Delivered" value={String(physicalPaid.filter((o) => o.status === 'delivered').length)} tone="green" />
            <Kpi label="Average time to ship" value={shipDays.length ? `${avgShip.toFixed(1)} days` : '—'} sub="payment → shipped" />
          </div>
          <ReportTable
            title="Books to ship" subtitle="Paid orders waiting to be sent, oldest first." file="shop-to-ship" rows={[...toShip].sort((a, b) => +new Date(a.paid_at ?? a.created_at) - +new Date(b.paid_at ?? b.created_at))} empty="Nothing waiting to be shipped."
            cols={[
              { head: 'Order', cell: (o) => o.order_no },
              { head: 'Paid on', cell: (o) => fmtDate(o.paid_at) },
              { head: 'Waiting', cell: (o) => `${Math.floor(hoursSince(o.paid_at ?? o.created_at) / 24)} days`, csv: (o) => Math.floor(hoursSince(o.paid_at ?? o.created_at) / 24) },
              { head: 'Customer', cell: (o) => `${o.customer_name} · ${o.phone}` },
              { head: 'Address', cell: (o) => `${o.ship_address ?? ''}, ${o.ship_city ?? ''}, ${o.ship_state ?? ''} - ${o.ship_pincode ?? ''}` },
              { head: 'Books', cell: (o) => o.shop_order_items.filter((i) => i.format === 'physical').map((i) => `${i.title} ×${i.qty}`).join('; ') },
            ]}
          />
          <ReportTable
            title="Shipped and delivered" file="shop-shipped" rows={shippedRows} empty="Nothing shipped in this period."
            cols={[
              { head: 'Order', cell: (o) => o.order_no },
              { head: 'Shipped on', cell: (o) => fmtDate(o.shipped_at) },
              { head: 'Courier', cell: (o) => o.courier ?? '' },
              { head: 'Tracking no', cell: (o) => o.tracking_no ?? '' },
              { head: 'Status', cell: (o) => STATUS_TEXT[o.status] },
              { head: 'Delivered on', cell: (o) => fmtDate(o.delivered_at) },
            ]}
          />
          <ReportTable
            title="Where the books go" subtitle="Physical orders by state and city." file="shop-places" rows={places} empty="No physical orders in this period."
            cols={[{ head: 'State · City', cell: (p) => p.place }, { head: 'Orders', cell: (p) => p.n, align: 'right' }, { head: 'Value', cell: (p) => money(p.amt, symbol), csv: (p) => p.amt, align: 'right' }]}
          />
          <ReportTable
            title="E-book downloads" file="shop-ebook-downloads" rows={downloads} empty="No e-book sold in this period."
            cols={[
              { head: 'Order', cell: (d) => d.o.order_no },
              { head: 'E-book', cell: (d) => d.i.title },
              { head: 'Customer', cell: (d) => d.o.customer_name },
              { head: 'Downloads', cell: (d) => d.i.download_count, align: 'right' },
            ]}
          />
        </>
      )}
    </div>
  );
}
