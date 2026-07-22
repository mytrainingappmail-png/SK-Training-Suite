// src/repositories/payment/paymentRepository.ts
//
// Repository layer — Supabase ONLY. payment_settings is a singleton
// (one row) table. Razorpay order creation is delegated to a Supabase
// Edge Function — the Razorpay secret key must never live in this
// client-side code.

import { supabase } from '../../lib/supabase';
import type { PaymentSettings, PaymentSettingsForm } from '../../types/payment';

export async function getPaymentSettings(): Promise<PaymentSettings | null> {
  const { data, error } = await supabase.from('payment_settings').select('*').limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function upsertPaymentSettings(id: string | null, form: PaymentSettingsForm): Promise<PaymentSettings> {
  if (id) {
    const { data, error } = await supabase.from('payment_settings').update(form).eq('id', id).select().maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
    throw new Error('Payment settings not found after update.');
  }
  const { data, error } = await supabase.from('payment_settings').insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  return { id: '', updated_at: '', ...form };
}

export interface CreateRazorpayOrderParams {
  amountInRupees: number;
  companyId: string;
  companyLicenseId: string;
  planId: string;
}

export async function createRazorpayOrder(params: CreateRazorpayOrderParams): Promise<{ orderId: string; amount: number; currency: string; keyId: string }> {
  const { data, error } = await supabase.functions.invoke('create-razorpay-order', { body: params });
  if (error) throw new Error(error.message);
  return data;
}
