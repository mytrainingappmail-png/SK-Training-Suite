// The shop's shared state: what the shop shows (settings + products) and the visitor's cart. The cart is kept in this browser
// (nothing to log into); prices shown here are only for display - the database works out the real bill when the order is placed.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { loadShopInfo, loadShopProducts } from '../../services/shop/shopService';
import type { CartLine, ShopFormat, ShopInfo, ShopProduct } from '../../services/shop/shopService';

interface ShopContextValue {
  info: ShopInfo | null;
  products: ShopProduct[];
  loading: boolean;
  error: string;
  reload: () => void;
  cart: CartLine[];
  cartCount: number;
  addToCart: (productId: string, format: ShopFormat, qty?: number) => void;
  setQty: (productId: string, format: ShopFormat, qty: number) => void;
  removeFromCart: (productId: string, format: ShopFormat) => void;
  clearCart: () => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  symbol: string;
}

const Ctx = createContext<ShopContextValue | null>(null);
const CART_KEY = 'shop_cart';

function readCart(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]') as CartLine[];
    return raw.filter((l) => l && l.product_id && (l.format === 'physical' || l.format === 'ebook') && l.qty > 0);
  } catch { return []; }
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<ShopInfo | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<CartLine[]>(readCart);
  const [cartOpen, setCartOpen] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([loadShopInfo(), loadShopProducts().catch(() => [] as ShopProduct[])])
      .then(([i, p]) => { setInfo(i); setProducts(p); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'The shop could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // the cart only keeps what can still be bought
  useEffect(() => {
    if (loading || products.length === 0) return;
    setCart((c) => {
      const next = c.filter((l) => {
        const p = products.find((x) => x.id === l.product_id);
        return !!p && (l.format === 'physical' ? p.physical_enabled && p.physical_in_stock : p.ebook_enabled);
      });
      return next.length === c.length ? c : next;
    });
  }, [loading, products]);

  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* ignore */ } }, [cart]);

  const addToCart = useCallback((productId: string, format: ShopFormat, qty = 1) => {
    setCart((c) => {
      const existing = c.find((l) => l.product_id === productId && l.format === format);
      if (format === 'ebook') return existing ? c : [...c, { product_id: productId, format, qty: 1 }];
      const limit = products.find((p) => p.id === productId)?.physical_stock_left ?? 20;
      const nextQty = Math.min((existing?.qty ?? 0) + qty, Math.min(20, limit));
      return existing ? c.map((l) => (l === existing ? { ...l, qty: nextQty } : l)) : [...c, { product_id: productId, format, qty: Math.max(1, nextQty) }];
    });
    setCartOpen(true);
  }, [products]);

  const setQty = useCallback((productId: string, format: ShopFormat, qty: number) => {
    const limit = products.find((p) => p.id === productId)?.physical_stock_left ?? 20;
    setCart((c) => c.map((l) => (l.product_id === productId && l.format === format ? { ...l, qty: Math.max(1, Math.min(qty, Math.min(20, limit))) } : l)));
  }, [products]);

  const removeFromCart = useCallback((productId: string, format: ShopFormat) => {
    setCart((c) => c.filter((l) => !(l.product_id === productId && l.format === format)));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const value = useMemo<ShopContextValue>(() => ({
    info, products, loading, error, reload, cart, cartCount: cart.reduce((n, l) => n + l.qty, 0),
    addToCart, setQty, removeFromCart, clearCart, cartOpen, setCartOpen, symbol: info?.currency_symbol || '₹',
  }), [info, products, loading, error, reload, cart, addToCart, setQty, removeFromCart, clearCart, cartOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShop(): ShopContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useShop must be used inside the shop.');
  return v;
}
