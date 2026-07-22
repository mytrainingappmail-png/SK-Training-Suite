// src/types/payment.ts
//
// Payment & Billing — singleton settings (the SaaS owner's own payment
// details, shown to subscribing companies) + Razorpay online checkout
// configuration. Table: payment_settings (single row).

export interface PaymentSettings {
  id: string;
  upi_id: string;
  qr_code_url: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_name: string;
  razorpay_enabled: boolean;
  razorpay_key_id: string;
  updated_at: string;
}

export type PaymentSettingsForm = Omit<PaymentSettings, 'id' | 'updated_at'>;

export const defaultPaymentSettingsForm: PaymentSettingsForm = {
  upi_id: '',
  qr_code_url: '',
  bank_account_name: '',
  bank_account_number: '',
  bank_ifsc: '',
  bank_name: '',
  razorpay_enabled: false,
  razorpay_key_id: '',
};

export interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}
