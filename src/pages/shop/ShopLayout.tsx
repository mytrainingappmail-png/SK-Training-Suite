// The frame of every shop page: a header with the shop's name / logo, "My orders" and the cart button, the page itself, and a footer
// with the owner's contact details and policy. The shop name, wording and contact details all come from the owner's shop settings;
// the logo is the platform logo. If the owner has not opened the shop, visitors see a polite "closed" note.

import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { loadBranding } from '../../services/branding/brandingService';
import type { ResolvedBranding } from '../../services/branding/brandingService';
import { ShopProvider, useShop } from './ShopContext';
import CartDrawer from './CartDrawer';

function Frame() {
  const { info, loading, error, cartCount, setCartOpen, reload } = useShop();
  const [brand, setBrand] = useState<ResolvedBranding | null>(null);
  useEffect(() => { loadBranding().then(setBrand).catch(() => undefined); }, []);

  const name = info?.shop_name?.trim() || brand?.companyName || 'Shop';
  useEffect(() => { document.title = name; }, [name]);

  const wa = (info?.whatsapp_number ?? '').replace(/\D/g, '');

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-40 bg-[#0e1c3d] shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to={ROUTES.SHOP} className="flex min-w-0 items-center gap-3">
            {brand?.logoUrl
              ? <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1"><img src={brand.logoUrl} alt="" className="h-full w-full object-contain" /></span>
              : <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-slate-900">{name.charAt(0).toUpperCase()}</span>}
            <span className="truncate text-base font-extrabold text-white sm:text-lg">{name}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to={ROUTES.SHOP_ORDERS} className="whitespace-nowrap rounded-lg px-2 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 sm:px-3"><span className="sm:hidden">Orders</span><span className="hidden sm:inline">My orders</span></Link>
            <button onClick={() => setCartOpen(true)} aria-label="Open the cart" className="relative whitespace-nowrap rounded-xl bg-amber-400 px-3 py-2 text-sm font-extrabold text-slate-900 hover:bg-amber-300 sm:px-4">
              🛒 Cart
              {cartCount > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-white" />)}</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
            <p className="font-semibold">The shop could not be opened.</p>
            <p className="mt-1 text-sm">{error}</p>
            <button onClick={reload} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Try again</button>
          </div>
        ) : !info?.enabled ? (
          <div className="mx-auto max-w-md rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="text-5xl">🏪</div>
            <h1 className="mt-3 text-xl font-extrabold text-slate-900">The shop is closed right now</h1>
            <p className="mt-1 text-sm text-slate-500">Please visit again a little later.</p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {info?.enabled && (
        <footer className="mt-8 bg-[#0e1c3d] text-slate-300">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-2">
            <div>
              <p className="text-base font-extrabold text-white">{name}</p>
              {info.tagline && <p className="mt-1 text-slate-400">{info.tagline}</p>}
              <div className="mt-3 space-y-1">
                {wa && <p>💬 WhatsApp: <a className="font-semibold text-amber-300 hover:underline" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">+{wa}</a></p>}
                {info.support_phone && <p>📞 <a className="font-semibold text-amber-300 hover:underline" href={`tel:${info.support_phone}`}>{info.support_phone}</a></p>}
                {info.contact_email && <p>✉️ <a className="font-semibold text-amber-300 hover:underline" href={`mailto:${info.contact_email}`}>{info.contact_email}</a></p>}
              </div>
            </div>
            <div>
              {info.policy_text && (
                <details className="rounded-xl bg-white/5 p-3">
                  <summary className="cursor-pointer font-semibold text-white">Shipping, refund &amp; other policies</summary>
                  <p className="mt-2 whitespace-pre-line text-slate-300">{info.policy_text}</p>
                </details>
              )}
              <p className="mt-3 text-xs text-slate-400">
                <Link className="hover:underline" to="/legal/terms-of-service">Terms</Link> · <Link className="hover:underline" to="/legal/privacy-policy">Privacy</Link> · <Link className="hover:underline" to="/legal/refund-and-cancellation">Refunds</Link> · <Link className="hover:underline" to={ROUTES.CONTACT_US}>Contact</Link>
              </p>
            </div>
          </div>
        </footer>
      )}

      <CartDrawer />
    </div>
  );
}

export default function ShopLayout() {
  return (
    <ShopProvider>
      <Frame />
    </ShopProvider>
  );
}
