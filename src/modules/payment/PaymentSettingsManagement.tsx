// src/modules/payment/PaymentSettingsManagement.tsx
//
// Admin configures the SaaS owner's own payment details (UPI, QR code,
// bank account) shown to subscribing companies, plus optional Razorpay
// online checkout. Not yet wired into sidebar/routes — standalone module.

import { useEffect, useRef, useState } from 'react';
import { loadPaymentSettings, savePaymentSettings, uploadQrCode } from '../../services/payment/paymentService';
import { defaultPaymentSettingsForm } from '../../types/payment';
import type { PaymentSettings, PaymentSettingsForm } from '../../types/payment';

function IconUpload({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>);
}
function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}

function PrimaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">{children}</button>);
}
function SecondaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>{children}</button>);
}
const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

function Skeleton() {
  return (<div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>);
}

function PaymentSettingsManagement() {
  const [existing, setExisting] = useState<PaymentSettings | null>(null);
  const [form, setForm] = useState<PaymentSettingsForm>(defaultPaymentSettingsForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [toast, setToast] = useState('');
  const qrInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    loadPaymentSettings()
      .then((settings) => {
        setExisting(settings);
        if (settings) {
          setForm({
            upi_id: settings.upi_id,
            qr_code_url: settings.qr_code_url,
            bank_account_name: settings.bank_account_name,
            bank_account_number: settings.bank_account_number,
            bank_ifsc: settings.bank_ifsc,
            bank_name: settings.bank_name,
            razorpay_enabled: settings.razorpay_enabled,
            razorpay_key_id: settings.razorpay_key_id,
          });
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load payment settings.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function handleQrUpload(file: File) {
    setUploadingQr(true);
    try {
      const url = await uploadQrCode(file);
      setForm((f) => ({ ...f, qr_code_url: url }));
      showToast('QR code uploaded');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload QR code.');
    } finally {
      setUploadingQr(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await savePaymentSettings(existing, form);
      setExisting(saved);
      showToast('Payment settings saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save payment settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton />;
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-semibold">Failed to load payment settings</p>
        <p className="mt-1">{error}</p>
        <SecondaryButton onClick={fetchAll} className="mt-4">Try Again</SecondaryButton>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Payment Settings</h2>
        <p className="text-sm text-slate-500">These details are shown to companies when they need to pay for their subscription.</p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Manual Payment (UPI / Bank Transfer)</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">UPI ID</label>
            <input value={form.upi_id} onChange={(e) => setForm((f) => ({ ...f, upi_id: e.target.value }))} placeholder="yourname@upi" className={INPUT_CLS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">QR Code</label>
            <div className="flex items-center gap-3">
              {form.qr_code_url ? (
                <img src={form.qr_code_url} alt="Payment QR" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400 text-xs">No QR</div>
              )}
              <SecondaryButton onClick={() => qrInputRef.current?.click()}>
                {uploadingQr ? <IconSpinner className="h-3.5 w-3.5" /> : <IconUpload className="h-3.5 w-3.5" />} Upload
              </SecondaryButton>
              <input ref={qrInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleQrUpload(f); }} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Bank Account Name</label>
            <input value={form.bank_account_name} onChange={(e) => setForm((f) => ({ ...f, bank_account_name: e.target.value }))} className={INPUT_CLS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Bank Name</label>
            <input value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} className={INPUT_CLS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Account Number</label>
            <input value={form.bank_account_number} onChange={(e) => setForm((f) => ({ ...f, bank_account_number: e.target.value }))} className={INPUT_CLS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">IFSC Code</label>
            <input value={form.bank_ifsc} onChange={(e) => setForm((f) => ({ ...f, bank_ifsc: e.target.value.toUpperCase() }))} className={`${INPUT_CLS} font-mono`} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Razorpay (Online Checkout)</h3>
        <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.razorpay_enabled} onChange={(e) => setForm((f) => ({ ...f, razorpay_enabled: e.target.checked }))} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400" />
          Enable "Pay Online" for companies
        </label>
        {form.razorpay_enabled && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Razorpay Key ID</label>
            <input value={form.razorpay_key_id} onChange={(e) => setForm((f) => ({ ...f, razorpay_key_id: e.target.value }))} placeholder="rzp_live_xxxxxxxx" className={`${INPUT_CLS} max-w-sm font-mono`} />
            <p className="mt-2 text-xs text-slate-400">
              This is the public Key ID only — never enter your Razorpay Key Secret here. The secret must be set as a Supabase Edge Function secret (RAZORPAY_KEY_SECRET), never in this form.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <PrimaryButton onClick={handleSave} disabled={saving}>
          {saving ? <IconSpinner className="h-3.5 w-3.5" /> : null} Save Payment Settings
        </PrimaryButton>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default PaymentSettingsManagement;
