// src/services/shop/shopService.ts
//
// The public side of the shop (no login): what the shop shows, the price of a cart (always worked out by the database, never by the
// browser), placing an order, paying, tracking and downloading an e-book. The owner's side is in shopAdminService.ts.

import { supabase } from '../../lib/supabase';

export type ShopFormat = 'physical' | 'ebook';

export interface ShopInfo {
  enabled: boolean;
  shop_name?: string | null;
  tagline?: string | null;
  intro_text?: string | null;
  currency_symbol?: string;
  accept_upi?: boolean;
  upi_id?: string | null;
  upi_payee_name?: string | null;
  upi_qr_url?: string | null;
  shipping_fee?: number;
  free_shipping_above?: number | null;
  shipping_note?: string | null;
  whatsapp_number?: string | null;
  contact_email?: string | null;
  support_phone?: string | null;
  policy_text?: string | null;
  thank_you_note?: string | null;
  has_coupons?: boolean;
}

export interface ShopProduct {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  images: string[];
  physical_enabled: boolean;
  physical_price: number | null;
  physical_mrp: number | null;
  /** null = not counted (always available). */
  physical_stock_left: number | null;
  physical_in_stock: boolean;
  ebook_enabled: boolean;
  ebook_price: number | null;
  ebook_mrp: number | null;
  featured: boolean;
  display_order: number;
}

export interface CartLine {
  product_id: string;
  format: ShopFormat;
  qty: number;
}

export interface QuoteLine { product_id: string; format: ShopFormat; title: string; unit_price: number; qty: number; line_total: number }
export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  has_physical: boolean;
  has_ebook: boolean;
  coupon_code: string | null;
  coupon_error: string | null;
  free_shipping_above: number | null;
}

export interface CustomerForm {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  note: string;
}

export interface PlacedOrder { order_id: string; order_no: string; token: string; total: number; status: string }

export type OrderStatus = 'awaiting_payment' | 'payment_submitted' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItemView {
  id: string;
  format: ShopFormat;
  title: string;
  unit_price: number;
  qty: number;
  line_total: number;
  image: string | null;
  can_download: boolean;
  downloads_left: number | null;
}

export interface OrderView {
  order_no: string;
  status: OrderStatus;
  customer_name: string;
  phone: string;
  email: string | null;
  ship_address: string | null;
  ship_city: string | null;
  ship_state: string | null;
  ship_pincode: string | null;
  has_physical: boolean;
  has_ebook: boolean;
  subtotal: number;
  discount: number;
  coupon_code: string | null;
  shipping: number;
  total: number;
  payment_utr: string | null;
  payment_submitted_at: string | null;
  paid_at: string | null;
  courier: string | null;
  tracking_no: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  admin_note: string | null;
  created_at: string;
  items: OrderItemView[];
}

// ── reading ──

export async function loadShopInfo(): Promise<ShopInfo> {
  const { data, error } = await supabase.rpc('shop_public_info');
  if (error || !data) return { enabled: false };
  return data as ShopInfo;
}

export async function loadShopProducts(): Promise<ShopProduct[]> {
  const { data, error } = await supabase.rpc('shop_public_products', { p_id: null });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ShopProduct[]).map((p) => ({ ...p, images: p.images ?? [] }));
}

export async function getShopQuote(items: CartLine[], coupon: string, phone: string): Promise<Quote> {
  const { data, error } = await supabase.rpc('shop_quote', { p_items: items, p_coupon: coupon.trim() || null, p_phone: phone.trim() || null });
  if (error) throw new Error(error.message);
  return data as Quote;
}

// ── ordering ──

export async function placeShopOrder(items: CartLine[], customer: CustomerForm, coupon: string): Promise<PlacedOrder> {
  const { data, error } = await supabase.rpc('shop_place_order', { p_items: items, p_customer: customer, p_coupon: coupon.trim() || null });
  if (error) throw new Error(error.message);
  return data as PlacedOrder;
}

export async function getShopOrder(orderNo: string, secret: string): Promise<OrderView | null> {
  const { data, error } = await supabase.rpc('shop_get_order', { p_order_no: orderNo, p_secret: secret });
  if (error) throw new Error(error.message);
  return (data as OrderView | null) ?? null;
}

/** A payment screenshot goes to a private bucket (only the owner can open it); returns its path. */
export async function uploadPaymentProof(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) throw new Error('Please choose a PNG, JPG or WEBP picture.');
  if (file.size > 5 * 1024 * 1024) throw new Error('The picture must be under 5 MB.');
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `proofs/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('shop-proofs').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function submitShopPayment(orderNo: string, secret: string, utr: string, proofPath: string | null): Promise<void> {
  const { error } = await supabase.rpc('shop_submit_payment', { p_order_no: orderNo, p_secret: secret, p_utr: utr, p_proof_path: proofPath });
  if (error) throw new Error(error.message);
}

export async function cancelShopOrder(orderNo: string, secret: string): Promise<void> {
  const { error } = await supabase.rpc('shop_cancel_order', { p_order_no: orderNo, p_secret: secret });
  if (error) throw new Error(error.message);
}

/** Asks for a one-minute download link for a paid e-book and opens it. */
export async function downloadEbook(orderNo: string, secret: string, itemId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('shop-ebook-download', { body: { order_no: orderNo, secret, item_id: itemId } });
  if (error) {
    // the function answers with a readable message even for a refusal
    let message = 'The download could not be started. Please try again.';
    try {
      const ctx = (error as { context?: Response }).context;
      const j = ctx ? await ctx.json() : null;
      if (j?.error) message = j.error;
    } catch { /* keep the default */ }
    throw new Error(message);
  }
  const url = (data as { url?: string } | null)?.url;
  if (!url) throw new Error('The download could not be started. Please try again.');
  window.location.href = url;
}

// ── helpers ──

export function formatMoney(amount: number | null | undefined, symbol = '₹'): string {
  const n = Number(amount ?? 0);
  return `${symbol}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function discountPercent(price: number | null, mrp: number | null): number {
  if (!price || !mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

/** The order numbers this browser has placed (so "My orders" works without any login). */
export interface MyOrderRef { order_no: string; token: string; total: number; created_at: string }
const MY_ORDERS_KEY = 'shop_my_orders';

export function loadMyOrders(): MyOrderRef[] {
  try { return JSON.parse(localStorage.getItem(MY_ORDERS_KEY) || '[]') as MyOrderRef[]; } catch { return []; }
}
export function rememberOrder(ref: MyOrderRef): void {
  try {
    const rest = loadMyOrders().filter((o) => o.order_no !== ref.order_no);
    localStorage.setItem(MY_ORDERS_KEY, JSON.stringify([ref, ...rest].slice(0, 30)));
  } catch { /* ignore */ }
}
export function secretFor(orderNo: string): string | null {
  return loadMyOrders().find((o) => o.order_no.toUpperCase() === orderNo.toUpperCase())?.token ?? null;
}

/** The UPI payment link (opens the customer's UPI app with the amount filled in) - also what the QR carries. */
export function upiLink(info: ShopInfo, amount: number, orderNo: string): string {
  const p = new URLSearchParams();
  p.set('pa', info.upi_id ?? '');
  p.set('pn', info.upi_payee_name || info.shop_name || '');
  p.set('am', amount.toFixed(2));
  p.set('cu', 'INR');
  p.set('tn', orderNo);
  return `upi://pay?${p.toString().replace(/\+/g, '%20')}`;
}
