// Checkout: who is buying, where to send the book (only when there is a physical book), a coupon, and the bill. The bill is always
// worked out by the database. "Place order" creates the order and opens its page, where the customer pays by UPI.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { formatMoney, getShopQuote, placeShopOrder, rememberOrder } from '../../services/shop/shopService';
import type { CustomerForm, Quote } from '../../services/shop/shopService';
import { useShop } from './ShopContext';
import { BTN_LIGHT, BTN_PRIMARY, Cover, FIELD, FormatBadge } from './ShopBits';

const EMPTY: CustomerForm = { name: '', phone: '', email: '', address: '', city: '', state: '', pincode: '', note: '' };
const FORM_KEY = 'shop_customer';

function readForm(): CustomerForm {
  try { return { ...EMPTY, ...(JSON.parse(localStorage.getItem(FORM_KEY) || '{}') as Partial<CustomerForm>), note: '' }; } catch { return EMPTY; }
}

function Label({ children, hint }: { children: string; hint?: string }) {
  return <label className="mb-1 block text-xs font-bold text-slate-600">{children}{hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}</label>;
}

export default function ShopCheckoutPage() {
  const { cart, products, symbol, info, clearCart, loading } = useShop();
  const navigate = useNavigate();
  const [form, setForm] = useState<CustomerForm>(readForm);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof CustomerForm>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); setError(''); }

  // the exact bill (and the coupon's answer) from the database
  useEffect(() => {
    if (cart.length === 0) { setQuote(null); return; }
    let cancelled = false;
    setQuoteError('');
    getShopQuote(cart, coupon, form.phone)
      .then((q) => { if (!cancelled) setQuote(q); })
      .catch((e: unknown) => { if (!cancelled) setQuoteError(e instanceof Error ? e.message : 'Could not work out the total.'); });
    return () => { cancelled = true; };
  }, [cart, coupon, form.phone]);

  const imageOf = useMemo(() => new Map(products.map((p) => [p.id, p.images[0]] as const)), [products]);

  if (!loading && cart.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-white p-10 text-center shadow-sm">
        <div className="text-5xl">🛒</div>
        <p className="mt-2 font-bold text-slate-800">Your cart is empty</p>
        <Link to={ROUTES.SHOP} className={`${BTN_PRIMARY} mt-4`}>Browse books</Link>
      </div>
    );
  }

  const needsAddress = quote?.has_physical ?? cart.some((l) => l.format === 'physical');

  async function place() {
    setError('');
    if (form.name.trim().length < 2) { setError('Please enter your name.'); return; }
    if (form.phone.replace(/\D/g, '').length < 10) { setError('Please enter a valid 10 digit mobile number.'); return; }
    if (needsAddress) {
      if (!form.address.trim() || !form.city.trim() || !form.state.trim()) { setError('Please fill in your full delivery address.'); return; }
      if (!/^\d{6}$/.test(form.pincode.trim())) { setError('Please enter a 6 digit pincode.'); return; }
    }
    setPlacing(true);
    try {
      const placed = await placeShopOrder(cart, form, coupon);
      try { localStorage.setItem(FORM_KEY, JSON.stringify({ ...form, note: '' })); } catch { /* ignore */ }
      rememberOrder({ order_no: placed.order_no, token: placed.token, total: placed.total, created_at: new Date().toISOString() });
      clearCart();
      navigate(ROUTES.SHOP_ORDER.replace(':orderNo', placed.order_no), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The order could not be placed.');
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link to={ROUTES.SHOP} className="inline-block text-sm font-semibold text-indigo-600 hover:underline">← Keep shopping</Link>
      <h1 className="text-2xl font-extrabold text-slate-900">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-5">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-4 text-base font-extrabold text-slate-900">1 · Your details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Full name</Label><input value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" className={FIELD} placeholder="Your name" /></div>
              <div><Label>Mobile number</Label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" autoComplete="tel" className={FIELD} placeholder="10 digit number" /></div>
              <div className="sm:col-span-2"><Label hint="(for your receipt and updates)">Email</Label><input value={form.email} onChange={(e) => set('email', e.target.value)} type="email" autoComplete="email" className={FIELD} placeholder="you@example.com" /></div>
            </div>
          </section>

          {needsAddress && (
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-4 text-base font-extrabold text-slate-900">2 · Where should we send the book?</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label>Full address</Label><textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={3} autoComplete="street-address" className={FIELD} placeholder="House / flat no, street, area, landmark" /></div>
                <div><Label>City</Label><input value={form.city} onChange={(e) => set('city', e.target.value)} className={FIELD} /></div>
                <div><Label>State</Label><input value={form.state} onChange={(e) => set('state', e.target.value)} className={FIELD} /></div>
                <div><Label>Pincode</Label><input value={form.pincode} onChange={(e) => set('pincode', e.target.value)} inputMode="numeric" maxLength={6} className={FIELD} placeholder="6 digits" /></div>
              </div>
            </section>
          )}

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-base font-extrabold text-slate-900">{needsAddress ? '3' : '2'} · Anything to tell us? <span className="text-xs font-normal text-slate-400">(optional)</span></h2>
            <textarea value={form.note} onChange={(e) => set('note', e.target.value)} rows={2} className={FIELD} placeholder="e.g. please sign the book for…" />
          </section>
        </div>

        {/* the bill */}
        <aside className="h-fit space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-24">
          <h2 className="text-base font-extrabold text-slate-900">Your order</h2>
          <ul className="space-y-3">
            {(quote?.lines ?? []).map((l) => (
              <li key={`${l.product_id}-${l.format}`} className="flex gap-3">
                <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded-md bg-slate-100"><Cover src={imageOf.get(l.product_id)} title={l.title} /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{l.title}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500"><FormatBadge format={l.format} /> × {l.qty}</div>
                </div>
                <p className="text-sm font-bold text-slate-800">{formatMoney(l.line_total, symbol)}</p>
              </li>
            ))}
          </ul>

          {/* coupon */}
          <div>
            <Label>Coupon code</Label>
            <div className="flex gap-2">
              <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder={info?.has_coupons ? 'Enter code' : 'Have a code?'} className={`${FIELD} uppercase`} />
              <button onClick={() => setCoupon(couponInput.trim())} disabled={!couponInput.trim()} className={BTN_LIGHT}>Apply</button>
            </div>
            {coupon && quote && (
              quote.coupon_error
                ? <p className="mt-1.5 text-xs font-semibold text-red-600">✕ {quote.coupon_error}</p>
                : <p className="mt-1.5 flex items-center justify-between text-xs font-semibold text-emerald-700">
                    <span>✓ {quote.coupon_code} applied — you save {formatMoney(quote.discount, symbol)}</span>
                    <button onClick={() => { setCoupon(''); setCouponInput(''); }} className="text-slate-400 hover:text-red-500">Remove</button>
                  </p>
            )}
          </div>

          {quote ? (
            <dl className="space-y-1.5 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd className="font-semibold">{formatMoney(quote.subtotal, symbol)}</dd></div>
              {quote.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Coupon discount</dt><dd className="font-semibold">− {formatMoney(quote.discount, symbol)}</dd></div>}
              {quote.has_physical && <div className="flex justify-between"><dt className="text-slate-600">Shipping</dt><dd className="font-semibold">{quote.shipping > 0 ? formatMoney(quote.shipping, symbol) : 'Free'}</dd></div>}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-lg"><dt className="font-extrabold">Total</dt><dd className="font-black">{formatMoney(quote.total, symbol)}</dd></div>
            </dl>
          ) : quoteError ? <p className="text-sm text-red-600">{quoteError}</p> : <div className="h-20 animate-pulse rounded-lg bg-slate-100" />}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
          <button onClick={() => void place()} disabled={placing || !quote} className={`${BTN_PRIMARY} w-full !py-3.5 text-base`}>
            {placing ? 'Placing your order…' : quote && quote.total <= 0 ? 'Place order →' : 'Place order & pay →'}
          </button>
          <p className="text-center text-xs text-slate-400">{quote && quote.total <= 0 ? 'Nothing to pay.' : 'You will pay by UPI on the next page.'}</p>
        </aside>
      </div>
    </div>
  );
}
