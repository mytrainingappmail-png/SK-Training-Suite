// The storefront: a banner with the shop's own name and wording, a search box, Books / E-books filter and a grid of covers.

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { discountPercent } from '../../services/shop/shopService';
import type { ShopProduct } from '../../services/shop/shopService';
import { useShop } from './ShopContext';
import { BTN_PRIMARY, Cover, PriceTag, FIELD } from './ShopBits';

type Filter = 'all' | 'physical' | 'ebook';

function ProductCard({ p }: { p: ShopProduct }) {
  const { symbol, addToCart } = useShop();
  const navigate = useNavigate();
  const both = p.physical_enabled && p.ebook_enabled;
  const onlyOne = !both;
  // the lowest price shown on the card
  const price = p.physical_enabled && p.ebook_enabled ? Math.min(p.physical_price ?? Infinity, p.ebook_price ?? Infinity) : p.physical_enabled ? p.physical_price : p.ebook_price;
  const mrp = p.physical_enabled && p.ebook_enabled ? null : p.physical_enabled ? p.physical_mrp : p.ebook_mrp;
  const bestOff = Math.max(discountPercent(p.physical_price, p.physical_mrp), discountPercent(p.ebook_price, p.ebook_mrp));
  const soldOut = p.physical_enabled && !p.physical_in_stock && !p.ebook_enabled;
  const url = ROUTES.SHOP_PRODUCT.replace(':productId', p.id);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link to={url} className="relative block aspect-[3/4] overflow-hidden bg-slate-100">
        <Cover src={p.images[0]} title={p.title} className="transition duration-300 group-hover:scale-105" />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {p.featured && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold text-slate-900">⭐ Featured</span>}
          {bestOff > 0 && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">{bestOff}% off</span>}
        </div>
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
          {p.physical_enabled && <span className="rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-amber-800 shadow">📖 Book</span>}
          {p.ebook_enabled && <span className="rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-sky-700 shadow">📱 E-book</span>}
        </div>
        {soldOut && <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-base font-extrabold text-slate-700">Out of stock</div>}
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <Link to={url} className="line-clamp-2 text-sm font-extrabold leading-snug text-slate-900 hover:text-[#14264d] sm:text-base">{p.title}</Link>
        {p.subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{p.subtitle}</p>}
        <div className="mt-2">
          {both && <p className="text-[11px] font-semibold text-slate-500">Starting from</p>}
          <PriceTag price={price} mrp={mrp} symbol={symbol} />
        </div>
        <div className="mt-3 flex-1" />
        {onlyOne && !soldOut ? (
          <button
            onClick={() => addToCart(p.id, p.physical_enabled ? 'physical' : 'ebook')}
            className={`${BTN_PRIMARY} w-full !py-2.5`}
          >🛒 Add to cart</button>
        ) : (
          <button onClick={() => navigate(url)} className={`${BTN_PRIMARY} w-full !py-2.5`}>{soldOut ? 'View' : 'Choose format'}</button>
        )}
      </div>
    </article>
  );
}

export default function ShopHomePage() {
  const { info, products } = useShop();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (filter === 'physical' && !p.physical_enabled) return false;
      if (filter === 'ebook' && !p.ebook_enabled) return false;
      if (q && !`${p.title} ${p.subtitle ?? ''} ${p.description ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, filter, query]);

  const counts = useMemo(() => ({
    all: products.length,
    physical: products.filter((p) => p.physical_enabled).length,
    ebook: products.filter((p) => p.ebook_enabled).length,
  }), [products]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#14264d] via-[#0e1c3d] to-[#0a1430] px-6 py-8 text-white shadow-lg sm:px-10 sm:py-12">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">{info?.tagline || 'Books'}</p>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight sm:text-4xl">{info?.shop_name || 'Our books'}</h1>
        {info?.intro_text && <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-slate-200 sm:text-base">{info.intro_text}</p>}
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-100">
          <span className="rounded-full bg-white/10 px-3 py-1">📖 Delivered to your home</span>
          <span className="rounded-full bg-white/10 px-3 py-1">📱 E-books: instant download</span>
          {info?.accept_upi && <span className="rounded-full bg-white/10 px-3 py-1">💳 Pay by UPI / scan QR</span>}
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {([['all', 'All'], ['physical', '📖 Books'], ['ebook', '📱 E-books']] as const).map(([k, label]) => (
            <button
              key={k} onClick={() => setFilter(k)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${filter === k ? 'bg-[#14264d] text-white shadow' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}
            >{label} <span className="opacity-60">{counts[k]}</span></button>
          ))}
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 Search a book…" className={`${FIELD} sm:max-w-xs`} />
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <div className="text-5xl">📚</div>
          <p className="mt-2 font-bold text-slate-800">Books are coming soon</p>
          <p className="text-sm text-slate-500">Please visit again shortly.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm">No book matches your search.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
          {shown.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
