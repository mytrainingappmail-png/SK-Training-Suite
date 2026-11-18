// One book: a picture gallery (as many pictures as the owner added), the format to buy (book / e-book), price, stock, description.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { discountPercent, formatMoney } from '../../services/shop/shopService';
import type { ShopFormat } from '../../services/shop/shopService';
import { useShop } from './ShopContext';
import { BTN_DARK, BTN_PRIMARY, Cover, PriceTag } from './ShopBits';

export default function ShopProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const { products, info, symbol, addToCart, cart } = useShop();
  const navigate = useNavigate();
  const product = products.find((p) => p.id === productId);

  const [imgIndex, setImgIndex] = useState(0);
  const [format, setFormat] = useState<ShopFormat>('physical');
  const [qty, setQty] = useState(1);

  // the first available format is chosen
  useEffect(() => {
    if (!product) return;
    setImgIndex(0);
    setQty(1);
    setFormat(product.physical_enabled && (product.physical_in_stock || !product.ebook_enabled) ? 'physical' : 'ebook');
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.scrollTo(0, 0); }, [productId]);

  if (!product) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <p className="font-bold text-slate-800">This book is not available.</p>
        <Link to={ROUTES.SHOP} className="mt-3 inline-block font-semibold text-indigo-600 hover:underline">← Back to the shop</Link>
      </div>
    );
  }

  const images = product.images;
  const isPhysical = format === 'physical';
  const price = isPhysical ? product.physical_price : product.ebook_price;
  const mrp = isPhysical ? product.physical_mrp : product.ebook_mrp;
  const stockLeft = product.physical_stock_left;
  const soldOut = isPhysical && !product.physical_in_stock;
  const maxQty = Math.min(20, stockLeft ?? 20);
  const inCart = cart.some((l) => l.product_id === product.id && l.format === format);

  function add(goToCheckout: boolean) {
    addToCart(product!.id, format, isPhysical ? qty : 1);
    if (goToCheckout) navigate(ROUTES.SHOP_CHECKOUT);
  }

  const options: { key: ShopFormat; title: string; sub: string; p: number | null; m: number | null; off: boolean }[] = [];
  if (product.physical_enabled) options.push({ key: 'physical', title: '📖 Book', sub: product.physical_in_stock ? (stockLeft != null && stockLeft <= 5 ? `Only ${stockLeft} left` : 'Delivered to your address') : 'Out of stock', p: product.physical_price, m: product.physical_mrp, off: !product.physical_in_stock });
  if (product.ebook_enabled) options.push({ key: 'ebook', title: '📱 E-book', sub: 'Instant download after payment', p: product.ebook_price, m: product.ebook_mrp, off: false });

  return (
    <div className="space-y-5">
      <Link to={ROUTES.SHOP} className="inline-block text-sm font-semibold text-indigo-600 hover:underline">← All books</Link>

      <div className="grid gap-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 md:grid-cols-2 md:gap-10">
        {/* pictures */}
        <div>
          <div className="relative mx-auto aspect-[3/4] max-w-md overflow-hidden rounded-2xl bg-slate-100 shadow-md">
            <Cover src={images[imgIndex]} title={product.title} />
            {images.length > 1 && (
              <>
                <button onClick={() => setImgIndex((i) => (i - 1 + images.length) % images.length)} aria-label="Previous picture" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-lg font-bold shadow hover:bg-white">‹</button>
                <button onClick={() => setImgIndex((i) => (i + 1) % images.length)} aria-label="Next picture" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-lg font-bold shadow hover:bg-white">›</button>
                <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">{imgIndex + 1} / {images.length}</span>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="mx-auto mt-3 flex max-w-md gap-2 overflow-x-auto pb-1">
              {images.map((src, i) => (
                <button key={src + i} onClick={() => setImgIndex(i)} className={`h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg ring-2 transition ${i === imgIndex ? 'ring-amber-400' : 'ring-transparent opacity-70 hover:opacity-100'}`}>
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* details */}
        <div className="flex flex-col">
          {product.featured && <span className="mb-2 inline-block self-start rounded-full bg-amber-400 px-3 py-0.5 text-xs font-extrabold text-slate-900">⭐ Featured</span>}
          <h1 className="text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl">{product.title}</h1>
          {product.subtitle && <p className="mt-1 text-base text-slate-500">{product.subtitle}</p>}

          {options.length > 1 && <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">Choose a format</p>}
          <div className={`mt-2 grid gap-3 ${options.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {options.map((o) => (
              <button
                key={o.key} onClick={() => { setFormat(o.key); setQty(1); }} disabled={o.off && options.length > 1}
                className={`rounded-2xl border-2 p-3 text-left transition disabled:opacity-50 ${format === o.key ? 'border-[#14264d] bg-slate-50 shadow-sm' : 'border-slate-200 hover:border-slate-400'}`}
              >
                <p className="text-sm font-extrabold text-slate-900">{o.title}</p>
                <p className="mt-0.5 text-lg font-extrabold text-slate-900">{formatMoney(o.p, symbol)}</p>
                {discountPercent(o.p, o.m) > 0 && <p className="text-xs text-slate-400"><span className="line-through">{formatMoney(o.m, symbol)}</span> <span className="font-bold text-emerald-600">{discountPercent(o.p, o.m)}% off</span></p>}
                <p className={`mt-1 text-xs font-semibold ${o.off ? 'text-red-500' : stockLeft != null && stockLeft <= 5 && o.key === 'physical' ? 'text-amber-700' : 'text-slate-500'}`}>{o.sub}</p>
              </button>
            ))}
          </div>

          {options.length === 1 && <div className="mt-4"><PriceTag price={price} mrp={mrp} symbol={symbol} large /></div>}

          {isPhysical && !soldOut && (
            <div className="mt-5 flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-600">Quantity</span>
              <div className="inline-flex items-center rounded-xl border border-slate-300">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className="px-4 py-2 text-lg font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="Fewer">−</button>
                <span className="min-w-[2.5rem] text-center font-bold">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} className="px-4 py-2 text-lg font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="More">+</button>
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={() => add(false)} disabled={soldOut} className={BTN_PRIMARY}>{inCart ? '✓ In cart · add more' : '🛒 Add to cart'}</button>
            <button onClick={() => add(true)} disabled={soldOut} className={BTN_DARK}>⚡ Buy now</button>
          </div>
          {soldOut && <p className="mt-2 text-sm font-semibold text-red-600">This format is out of stock right now.</p>}

          <ul className="mt-5 space-y-1.5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            {isPhysical ? (
              <>
                <li>🚚 {info?.shipping_note || (info?.shipping_fee ? `Shipping ${formatMoney(info.shipping_fee, symbol)}${info.free_shipping_above ? `, free above ${formatMoney(info.free_shipping_above, symbol)}` : ''}` : 'Shipping to your address')}</li>
                <li>📦 Packed with care and sent by courier, with tracking.</li>
              </>
            ) : (
              <>
                <li>⚡ Your download opens as soon as the payment is confirmed.</li>
                <li>📱 Read on your phone, tablet or computer.</li>
              </>
            )}
            {info?.accept_upi && <li>💳 Pay easily by UPI app or by scanning a QR code.</li>}
          </ul>
        </div>
      </div>

      {product.description && (
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <h2 className="text-lg font-extrabold text-slate-900">About this book</h2>
          <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{product.description}</p>
        </section>
      )}
    </div>
  );
}
