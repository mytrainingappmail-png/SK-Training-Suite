// The cart that slides in from the right: items, quantity, the bill (worked out by the database) and a button to checkout.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { formatMoney, getShopQuote } from '../../services/shop/shopService';
import type { Quote } from '../../services/shop/shopService';
import { useShop } from './ShopContext';
import { BTN_PRIMARY, Cover, FormatBadge } from './ShopBits';

export default function CartDrawer() {
  const { cart, products, info, symbol, cartOpen, setCartOpen, setQty, removeFromCart } = useShop();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState('');

  const lines = useMemo(() => cart.map((l) => ({ line: l, product: products.find((p) => p.id === l.product_id) })).filter((x) => !!x.product), [cart, products]);

  // the exact bill, from the database (shipping depends on what is in the cart)
  useEffect(() => {
    if (!cartOpen || cart.length === 0) { setQuote(null); return; }
    let cancelled = false;
    setQuoteError('');
    getShopQuote(cart, '', '')
      .then((q) => { if (!cancelled) setQuote(q); })
      .catch((e: unknown) => { if (!cancelled) setQuoteError(e instanceof Error ? e.message : 'Could not work out the total.'); });
    return () => { cancelled = true; };
  }, [cart, cartOpen]);

  if (!cartOpen) return null;

  const freeAbove = info?.free_shipping_above ?? null;
  const toFree = quote && quote.has_physical && freeAbove != null && quote.subtotal < freeAbove ? freeAbove - quote.subtotal : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50" onClick={() => setCartOpen(false)} />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-extrabold text-slate-900">🛒 Your cart</h2>
          <button onClick={() => setCartOpen(false)} aria-label="Close the cart" className="rounded-full p-2 text-xl leading-none text-slate-500 hover:bg-slate-100">✕</button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="text-5xl">📚</div>
            <p className="font-semibold text-slate-700">Your cart is empty</p>
            <button onClick={() => { setCartOpen(false); navigate(ROUTES.SHOP); }} className={BTN_PRIMARY}>Browse books</button>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {lines.map(({ line, product }) => {
                const p = product!;
                const price = line.format === 'ebook' ? p.ebook_price : p.physical_price;
                const max = Math.min(20, p.physical_stock_left ?? 20);
                return (
                  <li key={`${line.product_id}-${line.format}`} className="flex gap-3">
                    <div className="h-24 w-[4.5rem] flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 shadow-sm"><Cover src={p.images[0]} title={p.title} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{p.title}</p>
                      <div className="mt-0.5"><FormatBadge format={line.format} /></div>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{formatMoney(price, symbol)}</p>
                      <div className="mt-1.5 flex items-center justify-between">
                        {line.format === 'physical' ? (
                          <div className="inline-flex items-center rounded-lg border border-slate-300">
                            <button onClick={() => setQty(line.product_id, line.format, line.qty - 1)} disabled={line.qty <= 1} aria-label="Fewer" className="px-3 py-1 text-lg font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30">−</button>
                            <span className="min-w-[2rem] text-center text-sm font-bold">{line.qty}</span>
                            <button onClick={() => setQty(line.product_id, line.format, line.qty + 1)} disabled={line.qty >= max} aria-label="More" className="px-3 py-1 text-lg font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30">+</button>
                          </div>
                        ) : <span className="text-xs text-slate-500">Instant download after payment</span>}
                        <button onClick={() => removeFromCart(line.product_id, line.format)} className="text-xs font-semibold text-red-500 hover:underline">Remove</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
              {toFree != null && (
                <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">🚚 Add {formatMoney(toFree, symbol)} more for free shipping</p>
              )}
              {quoteError && <p className="mb-2 text-xs text-red-600">{quoteError}</p>}
              {quote && (
                <dl className="mb-3 space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd className="font-semibold">{formatMoney(quote.subtotal, symbol)}</dd></div>
                  {quote.has_physical && (
                    <div className="flex justify-between"><dt className="text-slate-600">Shipping</dt><dd className="font-semibold">{quote.shipping > 0 ? formatMoney(quote.shipping, symbol) : 'Free'}</dd></div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base"><dt className="font-bold">Total</dt><dd className="font-extrabold">{formatMoney(quote.total, symbol)}</dd></div>
                </dl>
              )}
              {info?.has_coupons && <p className="mb-3 text-xs text-slate-500">🏷 Have a coupon code? You can use it on the next page.</p>}
              <button onClick={() => { setCartOpen(false); navigate(ROUTES.SHOP_CHECKOUT); }} className={`${BTN_PRIMARY} w-full`}>Checkout →</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
