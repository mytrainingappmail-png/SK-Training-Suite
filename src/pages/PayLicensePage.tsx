// A genuinely public page — no login required. A platform operator
// sends a company this link (/pay/:licenseId) to collect an online
// payment for their subscription; the payer never needs an LMS account.
// Renders the same PaymentInstructions used anywhere else a "pay for
// this license" moment might come up.

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPublicLicensePaymentInfo } from "../repositories/payment/publicLicensePaymentRepository";
import type { PublicLicensePaymentInfo } from "../repositories/payment/publicLicensePaymentRepository";
import PaymentInstructions from "../modules/payment/PaymentInstructions";
import { ROUTES } from "../constants/routes";

function PayLicensePage() {
  const { licenseId } = useParams<{ licenseId: string }>();
  const navigate = useNavigate();
  const [info, setInfo] = useState<PublicLicensePaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!licenseId) return;
    getPublicLicensePaymentInfo(licenseId)
      .then(setInfo)
      .finally(() => setLoading(false));
  }, [licenseId]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-lg">
        <button onClick={() => navigate(ROUTES.LOGIN)} className="mb-6 inline-block text-sm font-semibold text-indigo-600 hover:underline">
          ← Back
        </button>

        {loading && <div className="h-64 animate-pulse rounded-2xl bg-white shadow-sm" />}

        {!loading && !info && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
            This payment link is invalid or has expired. Please contact whoever sent it to you for a new one.
          </div>
        )}

        {!loading && info && paid && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="text-lg font-bold text-emerald-800">Payment received!</p>
            <p className="mt-1 text-sm text-emerald-700">
              Thank you — your subscription for {info.company_name} has been renewed. You can close this page.
            </p>
          </div>
        )}

        {!loading && info && !paid && (
          <>
            <h1 className="mb-1 text-xl font-bold text-slate-900">{info.company_name}</h1>
            <p className="mb-6 text-sm text-slate-500">Complete your subscription payment below.</p>
            <PaymentInstructions
              companyId={info.company_id}
              companyLicenseId={licenseId!}
              planId={info.plan_id}
              planName={info.plan_name}
              amountInRupees={info.amount_in_rupees}
              companyName={info.company_name}
              companyEmail={info.company_email}
              onPaymentSuccess={() => setPaid(true)}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default PayLicensePage;
