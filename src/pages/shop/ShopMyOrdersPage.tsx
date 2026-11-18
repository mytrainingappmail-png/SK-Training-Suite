// "My orders": the orders placed from this phone / computer (no login needed), and a way to find an order by its number plus the
// mobile number used.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { formatMoney, getShopOrder, loadMyOrders, rememberOrder } from '../../services/shop/shopService';
import type { MyOrderRef, OrderStatus } from '../../services/shop/shopService';
import { useShop } from './ShopContext';
import { BTN_DARK, FIELD } from './ShopBits';

const STATUS_LABEL: Record<OrderStatus, { text: string; cls: string }> = {
  awaiting_payment: { text: 'Waiting for payment', cls: 'bg-amber-100 text-amber-800' },
  payment_submitted: { text: 'Payment being checked', cls: 'bg-sky-100 text-sky-800' },
  paid: { text: 'Confirmed', cls: 'bg-emerald-100 text-emerald-800' },
  shipped: { text: 'Shipped', cls: 'bg-indigo-100 text-indigo-800' },
  delivered: { text: 'Delivered', cls: 'bg-emerald-100 text-emerald-800' },
  cancelled: { text: 'Cancelled', cls: 'bg-red-100 text-red-700' },
};

export default function ShopMyOrdersPage() {
  const { symbol } = useShop();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<MyOrderRef[]>(loadMyOrders);
  const [status, setStatus] = useState<Record<string, OrderStatus>>({});
  const [orderNo, setOrderNo] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    orders.forEach((o) => {
      getShopOrder(o.order_no, o.token).then((v) => { if (!cancelled && v) setStatus((s) => ({ ...s, [o.order_no]: v.status })); }).catch(() => undefined);
    });
    return () => { cancelled = true; };
  }, [orders]);

  async function find() {
    setError('');
    setBusy(true);
    try {
      const v = await getShopOrder(orderNo.trim(), phone.trim());
      if (!v) { setError('We could not find an order with that number and mobile number.'); return; }
      rememberOrder({ order_no: v.order_no, token: phone.trim(), total: v.total, created_at: v.created_at });
      setOrders(loadMyOrders());
      navigate(ROUTES.SHOP_ORDER.replace(':orderNo', v.order_no));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The order could not be found.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to={ROUTES.SHOP} className="inline-block text-sm font-semibold text-indigo-600 hover:underline">← Back to the shop</Link>
      <h1 className="text-2xl font-extrabold text-slate-900">My orders</h1>

      {orders.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">No orders from this device yet.</div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const st = status[o.order_no];
            return (
              <li key={o.order_no}>
                <Link to={ROUTES.SHOP_ORDER.replace(':orderNo', o.order_no)} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md">
                  <div>
                    <p className="font-extrabold text-slate-900">{o.order_no}</p>
                    <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · {formatMoney(o.total, symbol)}</p>
                  </div>
                  {st ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_LABEL[st].cls}`}>{STATUS_LABEL[st].text}</span> : <span className="text-xs text-slate-400">…</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-extrabold text-slate-900">Find an order</h2>
        <p className="text-xs text-slate-500">Ordered from another phone? Enter the order number and the mobile number you gave.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="Order number" className={FIELD} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Mobile number" className={FIELD} />
        </div>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <button onClick={() => void find()} disabled={busy || !orderNo.trim() || phone.replace(/\D/g, '').length < 10} className={BTN_DARK}>{busy ? 'Searching…' : 'Find my order'}</button>
      </section>
    </div>
  );
}
