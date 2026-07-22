// src/modules/payment/PaymentInstructions.tsx
//
// Customer-facing: shown to a company that needs to pay for a plan.
// Always shows the manual UPI/QR/Bank details (if configured) and,
// when Razorpay is enabled, a real "Pay Online" button that loads
// Razorpay's checkout.js and creates a real order via the
// create-razorpay-order Edge Function. Not yet wired into any page —
// standalone component, pass it a plan + company + license id from
// wherever a "Renew" or "Upgrade" action lives.

import { useEffect, useState } from 'react';
import { loadPaymentSettings, startRazorpayCheckout } from '../../services/payment/paymentService';
import type { PaymentSettings } from '../../types/payment';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}

function PrimaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">{children}</button>);
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export interface PaymentInstructionsProps {
  companyId: string;
  companyLicenseId: string;
  planId: string;
  planName: string;
  amountInRupees: number;
  companyName: string;
  companyEmail: string;
  onPaymentSuccess?: () => void;
}

function PaymentInstructions({
  companyId, companyLicenseId, planId, planName, amountInRupees, companyName, companyEmail, onPaymentSuccess,
}: PaymentInstructionsProps) {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPaymentSettings()
      .then(setSettings)
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
  }, []);

  async function handlePayOnline() {
    if (!settings) return;
    setPaying(true);
    setError('');
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error('Could not load the payment gateway. Check your internet connection.');

      const order = await startRazorpayCheckout({ amountInRupees, companyId, companyLicenseId, planId });

      if (!window.Razorpay) throw new Error('Payment gateway failed to initialize.');

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Subscription Payment',
        description: `${planName} plan`,
        prefill: { name: companyName, email: companyEmail },
        handler: () => {
          onPaymentSuccess?.();
        },
        theme: { color: '#4f46e5' },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start online payment.');
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (!settings) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">
        Payment details haven't been configured yet — please contact support.
      </div>
    );
  }

  const hasManualDetails = !!(settings.upi_id || settings.qr_code_url || settings.bank_account_number);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="mb-1 text-sm text-slate-500">Amount Due</p>
        <p className="text-2xl font-bold text-slate-900">₹{amountInRupees.toLocaleString()}</p>
        <p className="text-xs text-slate-400">{planName} plan</p>
      </div>

      {settings.razorpay_enabled && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Pay Online</h3>
          <PrimaryButton onClick={handlePayOnline} disabled={paying}>
            {paying ? <IconSpinner className="h-3.5 w-3.5" /> : null} Pay ₹{amountInRupees.toLocaleString()} Now
          </PrimaryButton>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      )}

      {hasManualDetails && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Pay via UPI / Bank Transfer</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {settings.qr_code_url && (
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500">Scan QR Code</p>
                <img src={settings.qr_code_url} alt="Payment QR" className="h-40 w-40 rounded-lg border border-slate-200 object-cover" />
              </div>
            )}
            <div className="space-y-2 text-sm">
              {settings.upi_id && (
                <p><span className="font-semibold text-slate-500">UPI ID:</span> <span className="font-mono text-slate-800">{settings.upi_id}</span></p>
              )}
              {settings.bank_account_number && (
                <>
                  <p><span className="font-semibold text-slate-500">Account Name:</span> {settings.bank_account_name}</p>
                  <p><span className="font-semibold text-slate-500">Bank:</span> {settings.bank_name}</p>
                  <p><span className="font-semibold text-slate-500">Account Number:</span> <span className="font-mono">{settings.bank_account_number}</span></p>
                  <p><span className="font-semibold text-slate-500">IFSC:</span> <span className="font-mono">{settings.bank_ifsc}</span></p>
                </>
              )}
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            After paying manually, please share the payment reference with your administrator — they will activate your license from the Company Licenses screen.
          </p>
        </div>
      )}
    </div>
  );
}

export default PaymentInstructions;
