// src/services/shop/shopAdminService.ts
//
// The shop owner's side: shop settings, books, coupons and orders. Only the platform owner's company can read or change these
// (the database enforces it); every order change goes through a database function so stock and coupons stay right.

import { supabase } from '../../lib/supabase';
import type { OrderStatus } from './shopService';

export interface ShopSettings {
  enabled: boolean;
  shop_name: string | null;
  tagline: string | null;
  intro_text: string | null;
  currency_symbol: string;
  accept_upi: boolean;
  upi_id: string | null;
  upi_payee_name: string | null;
  upi_qr_url: string | null;
  shipping_fee: number;
  free_shipping_above: number | null;
  shipping_note: string | null;
  whatsapp_number: string | null;
  contact_email: string | null;
  support_phone: string | null;
  policy_text: string | null;
  thank_you_note: string | null;
  order_prefix: string;
  phone_country_code: string;
  ebook_download_limit: number | null;
}

export interface AdminProduct {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  images: string[];
  physical_enabled: boolean;
  physical_price: number | null;
  physical_mrp: number | null;
  physical_stock: number | null;
  ebook_enabled: boolean;
  ebook_price: number | null;
  ebook_mrp: number | null;
  ebook_file_path: string | null;
  ebook_file_name: string | null;
  featured: boolean;
  active: boolean;
  display_order: number;
  created_at: string;
}

export interface AdminCoupon {
  id: string;
  code: string;
  description: string | null;
  kind: 'percent' | 'flat';
  value: number;
  min_order: number;
  max_discount: number | null;
  applies_to: 'all' | 'physical' | 'ebook';
  valid_from: string | null;
  valid_until: string | null;
  usage_limit: number | null;
  per_phone_limit: number | null;
  used_count: number;
  active: boolean;
  created_at: string;
}

export interface AdminOrderItem {
  id: string;
  product_id: string | null;
  format: 'physical' | 'ebook';
  title: string;
  unit_price: number;
  qty: number;
  line_total: number;
  download_count: number;
}

export interface AdminOrder {
  id: string;
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
  payment_proof_path: string | null;
  payment_submitted_at: string | null;
  paid_at: string | null;
  courier: string | null;
  tracking_no: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  customer_note: string | null;
  admin_note: string | null;
  created_at: string;
  shop_order_items: AdminOrderItem[];
}

const nul = (v: string | null | undefined): string | null => { const s = (v ?? '').trim(); return s === '' ? null : s; };
const numOrNull = (v: number | string | null | undefined): number | null => { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

// ── settings ──
export async function loadShopSettings(): Promise<ShopSettings> {
  const { data, error } = await supabase.from('shop_settings').select('*').eq('id', true).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('The shop settings are not available. Please run the shop database update first.');
  return data as ShopSettings;
}

export async function saveShopSettings(s: Partial<ShopSettings>): Promise<void> {
  const patch: Record<string, unknown> = { ...s, updated_at: new Date().toISOString() };
  for (const k of ['shop_name', 'tagline', 'intro_text', 'upi_id', 'upi_payee_name', 'upi_qr_url', 'shipping_note', 'whatsapp_number', 'contact_email', 'support_phone', 'policy_text', 'thank_you_note'] as const) {
    if (k in patch) patch[k] = nul(patch[k] as string | null);
  }
  if ('free_shipping_above' in patch) patch.free_shipping_above = numOrNull(patch.free_shipping_above as number | null);
  if ('ebook_download_limit' in patch) patch.ebook_download_limit = numOrNull(patch.ebook_download_limit as number | null);
  if ('shipping_fee' in patch) patch.shipping_fee = numOrNull(patch.shipping_fee as number | null) ?? 0;
  if ('order_prefix' in patch) patch.order_prefix = ((patch.order_prefix as string) || '').trim().replace(/[^A-Za-z0-9-]/g, '').toUpperCase() || 'ORD';
  if ('phone_country_code' in patch) patch.phone_country_code = ((patch.phone_country_code as string) || '').replace(/\D/g, '') || '91';
  const { error } = await supabase.from('shop_settings').update(patch).eq('id', true);
  if (error) throw new Error(error.message);
}

// ── pictures and files ──
export async function uploadShopImage(file: File, folder = 'products'): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) throw new Error(`"${file.name}" is not a PNG, JPG, WEBP or GIF picture.`);
  if (file.size > 8 * 1024 * 1024) throw new Error(`"${file.name}" is bigger than 8 MB. Please use a smaller picture.`);
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('shop-images').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (error) throw new Error(error.message);
  return supabase.storage.from('shop-images').getPublicUrl(path).data.publicUrl;
}

export async function uploadEbookFile(file: File): Promise<{ path: string; name: string }> {
  if (file.size > 50 * 1024 * 1024) throw new Error('The e-book file is bigger than 50 MB. Please compress it and try again.');
  const ext = (file.name.split('.').pop() ?? 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
  const path = `books/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('shop-ebooks').upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (error) throw new Error(error.message);
  return { path, name: file.name };
}

export async function removeEbookFile(path: string): Promise<void> {
  await supabase.storage.from('shop-ebooks').remove([path]);
}

/** A one-hour link to look at a customer's payment screenshot. */
export async function proofUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('shop-proofs').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

// ── products ──
export async function loadAdminProducts(): Promise<AdminProduct[]> {
  const { data, error } = await supabase.from('shop_products').select('*').order('display_order').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminProduct[];
}

export type ProductDraft = Omit<AdminProduct, 'id' | 'created_at'> & { id?: string };

export async function saveAdminProduct(d: ProductDraft): Promise<string> {
  if (!d.title.trim()) throw new Error('Please give the book a title.');
  if (!d.physical_enabled && !d.ebook_enabled) throw new Error('Switch on at least one format: Book or E-book.');
  if (d.physical_enabled && numOrNull(d.physical_price) == null) throw new Error('Enter the price of the book.');
  if (d.ebook_enabled && numOrNull(d.ebook_price) == null) throw new Error('Enter the price of the e-book.');
  if (d.ebook_enabled && !d.ebook_file_path) throw new Error('Upload the e-book file, or switch the E-book off.');
  const row = {
    title: d.title.trim(), subtitle: nul(d.subtitle), description: nul(d.description), images: d.images,
    physical_enabled: d.physical_enabled, physical_price: d.physical_enabled ? numOrNull(d.physical_price) : numOrNull(d.physical_price),
    physical_mrp: numOrNull(d.physical_mrp), physical_stock: numOrNull(d.physical_stock),
    ebook_enabled: d.ebook_enabled, ebook_price: numOrNull(d.ebook_price), ebook_mrp: numOrNull(d.ebook_mrp),
    ebook_file_path: d.ebook_file_path, ebook_file_name: nul(d.ebook_file_name),
    featured: d.featured, active: d.active, display_order: Number(d.display_order) || 0, updated_at: new Date().toISOString(),
  };
  if (d.id) {
    const { error } = await supabase.from('shop_products').update(row).eq('id', d.id);
    if (error) throw new Error(error.message);
    return d.id;
  }
  const { data, error } = await supabase.from('shop_products').insert(row).select('id').single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function setProductActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('shop_products').update({ active, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteAdminProduct(p: AdminProduct): Promise<void> {
  const { error } = await supabase.from('shop_products').delete().eq('id', p.id);
  if (error) throw new Error(error.message);
  if (p.ebook_file_path) await removeEbookFile(p.ebook_file_path).catch(() => undefined);
}

// ── coupons ──
export async function loadAdminCoupons(): Promise<AdminCoupon[]> {
  const { data, error } = await supabase.from('shop_coupons').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminCoupon[];
}

export type CouponDraft = Omit<AdminCoupon, 'id' | 'created_at' | 'used_count'> & { id?: string };

export async function saveAdminCoupon(d: CouponDraft): Promise<void> {
  const code = d.code.trim().toUpperCase().replace(/\s+/g, '');
  if (!code) throw new Error('Enter the coupon code.');
  const value = numOrNull(d.value);
  if (value == null || value <= 0) throw new Error(d.kind === 'percent' ? 'Enter the percentage.' : 'Enter the discount amount.');
  if (d.kind === 'percent' && value > 100) throw new Error('A percentage cannot be more than 100.');
  const row = {
    code, description: nul(d.description), kind: d.kind, value, min_order: numOrNull(d.min_order) ?? 0,
    max_discount: d.kind === 'percent' ? numOrNull(d.max_discount) : null, applies_to: d.applies_to,
    valid_from: d.valid_from ? new Date(d.valid_from).toISOString() : null, valid_until: d.valid_until ? new Date(d.valid_until).toISOString() : null,
    usage_limit: numOrNull(d.usage_limit), per_phone_limit: numOrNull(d.per_phone_limit), active: d.active,
  };
  const { error } = d.id ? await supabase.from('shop_coupons').update(row).eq('id', d.id) : await supabase.from('shop_coupons').insert(row);
  if (error) throw new Error(/duplicate key/i.test(error.message) ? 'That coupon code already exists.' : error.message);
}

export async function setCouponActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('shop_coupons').update({ active }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteAdminCoupon(id: string): Promise<void> {
  const { error } = await supabase.from('shop_coupons').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── orders ──
export async function loadAdminOrders(): Promise<AdminOrder[]> {
  const { data, error } = await supabase.from('shop_orders').select('*, shop_order_items(*)').order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminOrder[];
}

export async function setOrderStatus(orderId: string, status: OrderStatus, opts: { courier?: string; tracking?: string; note?: string } = {}): Promise<void> {
  const { error } = await supabase.rpc('shop_admin_set_order_status', {
    p_order: orderId, p_status: status, p_courier: opts.courier ?? null, p_tracking: opts.tracking ?? null, p_note: opts.note ?? null,
  });
  if (error) throw new Error(error.message);
}
