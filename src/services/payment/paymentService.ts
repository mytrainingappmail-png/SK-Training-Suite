// src/services/payment/paymentService.ts
//
// Service layer — validation + orchestration. QR upload reuses the
// existing, unmodified uploadImage() from contentEditorService (same
// Storage pipeline every other image upload in this app already uses).

import { getPaymentSettings, upsertPaymentSettings, createRazorpayOrder } from '../../repositories/payment/paymentRepository';
import { uploadImage } from '../contentEditor/contentEditorService';
import type { PaymentSettings, PaymentSettingsForm } from '../../types/payment';
import type { CreateRazorpayOrderParams } from '../../repositories/payment/paymentRepository';

export async function loadPaymentSettings(): Promise<PaymentSettings | null> {
  return getPaymentSettings();
}

function validatePaymentSettingsForm(form: PaymentSettingsForm): void {
  if (form.razorpay_enabled && !form.razorpay_key_id.trim()) {
    throw new Error('Razorpay Key ID is required when Razorpay is enabled.');
  }
  if (!form.upi_id.trim() && !form.bank_account_number.trim() && !form.razorpay_enabled) {
    throw new Error('Add at least one payment method — UPI, bank details, or enable Razorpay.');
  }
}

export async function savePaymentSettings(existing: PaymentSettings | null, form: PaymentSettingsForm): Promise<PaymentSettings> {
  validatePaymentSettingsForm(form);
  return upsertPaymentSettings(existing?.id ?? null, form);
}

export async function uploadQrCode(file: File): Promise<string> {
  const result = await uploadImage(file);
  return result.url;
}

export async function startRazorpayCheckout(params: CreateRazorpayOrderParams): Promise<CreateRazorpayOrderParams & { orderId: string; amount: number; currency: string; keyId: string }> {
  const order = await createRazorpayOrder(params);
  return { ...params, ...order };
}
