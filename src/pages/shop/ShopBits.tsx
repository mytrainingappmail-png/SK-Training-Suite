// Small pieces shared by the shop pages: price, discount badge, format badge, a book cover with a fallback.

import { discountPercent, formatMoney } from '../../services/shop/shopService';
import type { ShopFormat } from '../../services/shop/shopService';

export function PriceTag({ price, mrp, symbol, large = false }: { price: number | null; mrp: number | null; symbol: string; large?: boolean }) {
  const off = discountPercent(price, mrp);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={`${large ? 'text-3xl' : 'text-lg'} font-extrabold text-slate-900`}>{formatMoney(price, symbol)}</span>
      {off > 0 && (
        <>
          <span className={`${large ? 'text-base' : 'text-xs'} text-slate-400 line-through`}>{formatMoney(mrp, symbol)}</span>
          <span className={`${large ? 'text-sm' : 'text-[11px]'} rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700`}>{off}% off</span>
        </>
      )}
    </div>
  );
}

export function FormatBadge({ format }: { format: ShopFormat }) {
  return format === 'ebook'
    ? <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700">📱 E-book</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">📖 Book</span>;
}

/** A book cover (first picture), or a plain navy cover with the first letters of the title when there is no picture. */
export function Cover({ src, title, className = '' }: { src?: string | null; title: string; className?: string }) {
  if (src) return <img src={src} alt={title} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  return (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-[#14264d] to-[#0b1630] p-3 text-center text-sm font-bold leading-snug text-amber-300 ${className}`}>
      {title.slice(0, 40)}
    </div>
  );
}

export const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-slate-900 shadow-sm transition hover:bg-amber-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_DARK = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#14264d] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1b3366] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_LIGHT = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50';
export const FIELD = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#14264d] focus:ring-2 focus:ring-amber-300/60';
