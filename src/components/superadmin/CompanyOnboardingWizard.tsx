// src/components/superadmin/CompanyOnboardingWizard.tsx
//
// Platform-operator-only: onboards a brand-new client company in one
// go — Company, first Branch/Department, a full-access Super Admin
// role + login, and (optionally) an immediate License. Previously this
// whole sequence was a manual, developer-only set of database inserts.

import { useEffect, useState } from "react";

import { onboardCompany } from "../../services/company/companyOnboardingService";
import { getCompanies } from "../../repositories/company/companyRepository";
import { loadPlans } from "../../services/license/licenseService";
import type { SubscriptionPlan, BillingCycle } from "../../types/license";

function IconSpinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
function PrimaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">
      {children}
    </button>
  );
}
const INPUT_CLS = "w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40";
const SECTION_CLS = "rounded-2xl bg-white p-5 shadow-sm space-y-3";
const LABEL_CLS = "mb-1 block text-xs font-semibold text-slate-500";

interface FormState {
  company_name: string;
  short_name: string;
  company_code: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  gst_number: string;
  pan_number: string;
  branchName: string;
  departmentName: string;
  admin_first_name: string;
  admin_last_name: string;
  admin_employee_code: string;
  admin_email: string;
  admin_mobile: string;
  admin_password: string;
  issueLicenseNow: boolean;
  plan_id: string;
  start_date: string;
  end_date: string;
  billing_cycle: BillingCycle;
  grace_period_days: number;
  auto_renew: boolean;
  is_complimentary: boolean;
}

const EMPTY_FORM: FormState = {
  company_name: "",
  short_name: "",
  company_code: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  pincode: "",
  gst_number: "",
  pan_number: "",
  branchName: "Head Office",
  departmentName: "General",
  admin_first_name: "",
  admin_last_name: "",
  admin_employee_code: "00001",
  admin_email: "",
  admin_mobile: "",
  admin_password: "",
  issueLicenseNow: false,
  plan_id: "",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  billing_cycle: "yearly",
  grace_period_days: 7,
  auto_renew: false,
  is_complimentary: false,
};

export default function CompanyOnboardingWizard() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ companyName: string; companyCode: string; employeeCode: string } | null>(null);

  useEffect(() => {
    loadPlans().then(setPlans).catch(() => {});
    getCompanies()
      .then((companies) => setExistingCodes(new Set(companies.map((c) => c.company_code.toLowerCase()))))
      .catch(() => {});
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const codeTaken = form.company_code.trim() !== "" && existingCodes.has(form.company_code.trim().toLowerCase());

  const canSubmit =
    form.company_name.trim() !== "" &&
    form.short_name.trim() !== "" &&
    form.company_code.trim() !== "" &&
    !codeTaken &&
    form.branchName.trim() !== "" &&
    form.departmentName.trim() !== "" &&
    form.admin_first_name.trim() !== "" &&
    form.admin_employee_code.trim() !== "" &&
    form.admin_password.trim().length >= 6 &&
    (!form.issueLicenseNow || (form.plan_id !== "" && form.end_date !== ""));

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const result = await onboardCompany({
        company: {
          company_code: form.company_code.trim(),
          company_name: form.company_name.trim(),
          short_name: form.short_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          website: form.website.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          country: form.country.trim(),
          pincode: form.pincode.trim(),
          gst_number: form.gst_number.trim(),
          pan_number: form.pan_number.trim(),
        },
        branchName: form.branchName.trim(),
        departmentName: form.departmentName.trim(),
        superAdmin: {
          first_name: form.admin_first_name.trim(),
          last_name: form.admin_last_name.trim(),
          employee_code: form.admin_employee_code.trim(),
          email: form.admin_email.trim(),
          mobile: form.admin_mobile.trim(),
          password: form.admin_password,
        },
        license: form.issueLicenseNow
          ? {
              plan_id: form.plan_id,
              start_date: form.start_date,
              end_date: form.end_date,
              billing_cycle: form.billing_cycle,
              grace_period_days: form.grace_period_days,
              auto_renew: form.auto_renew,
              is_complimentary: form.is_complimentary,
            }
          : undefined,
      });

      setSuccess({
        companyName: result.company.company_name,
        companyCode: result.company.company_code,
        employeeCode: form.admin_employee_code.trim(),
      });
      setForm(EMPTY_FORM);
      getCompanies()
        .then((companies) => setExistingCodes(new Set(companies.map((c) => c.company_code.toLowerCase()))))
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the company.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Add Company</h2>
        <p className="text-sm text-slate-500">Onboard a brand-new client — company, first branch/department, a full-access Super Admin login, and (optionally) a license, all in one go.</p>
      </div>

      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">✅ {success.companyName} is set up.</p>
          <p className="mt-1">Give the Super Admin these login details: Company Code <b>{success.companyCode}</b>, Employee ID <b>{success.employeeCode}</b>, and the password you chose.</p>
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Could not finish onboarding</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      <div className={SECTION_CLS}>
        <h3 className="text-sm font-bold text-slate-800">Company Details</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL_CLS}>Company Name *</label>
            <input className={INPUT_CLS} value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="e.g. InfraMantra Prop Pvt Ltd" />
          </div>
          <div>
            <label className={LABEL_CLS}>Short Name *</label>
            <input className={INPUT_CLS} value={form.short_name} onChange={(e) => set("short_name", e.target.value)} placeholder="e.g. InfraMantra" />
          </div>
          <div>
            <label className={LABEL_CLS}>Company Code * <span className="font-normal normal-case text-slate-400">(unique — used to log in)</span></label>
            <input className={`${INPUT_CLS} font-mono`} value={form.company_code} onChange={(e) => set("company_code", e.target.value.toUpperCase())} placeholder="e.g. IM001" />
            {codeTaken && <p className="mt-1 text-xs text-red-600">This company code is already in use.</p>}
          </div>
          <div>
            <label className={LABEL_CLS}>Website</label>
            <input className={INPUT_CLS} value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className={LABEL_CLS}>Email</label>
            <input className={INPUT_CLS} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLS}>Phone</label>
            <input className={INPUT_CLS} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL_CLS}>Address</label>
            <input className={INPUT_CLS} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Building, street, area" />
          </div>
          <div>
            <label className={LABEL_CLS}>City</label>
            <input className={INPUT_CLS} value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLS}>State</label>
            <input className={INPUT_CLS} value={form.state} onChange={(e) => set("state", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLS}>Country</label>
            <input className={INPUT_CLS} value={form.country} onChange={(e) => set("country", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLS}>Pincode</label>
            <input className={INPUT_CLS} value={form.pincode} onChange={(e) => set("pincode", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLS}>GST Number</label>
            <input className={INPUT_CLS} value={form.gst_number} onChange={(e) => set("gst_number", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLS}>PAN Number</label>
            <input className={INPUT_CLS} value={form.pan_number} onChange={(e) => set("pan_number", e.target.value)} />
          </div>
        </div>
      </div>

      <div className={SECTION_CLS}>
        <h3 className="text-sm font-bold text-slate-800">Branch &amp; Department</h3>
        <p className="text-xs text-slate-400">Every company needs at least one — more can be added later from Branches/Departments.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL_CLS}>First Branch Name *</label>
            <input className={INPUT_CLS} value={form.branchName} onChange={(e) => set("branchName", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLS}>First Department Name *</label>
            <input className={INPUT_CLS} value={form.departmentName} onChange={(e) => set("departmentName", e.target.value)} />
          </div>
        </div>
      </div>

      <div className={SECTION_CLS}>
        <h3 className="text-sm font-bold text-slate-800">Super Admin — First Login</h3>
        <p className="text-xs text-slate-400">This person logs in first and can then add the rest of the team, courses, etc. Gets full access to every section.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL_CLS}>First Name *</label>
            <input className={INPUT_CLS} value={form.admin_first_name} onChange={(e) => set("admin_first_name", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLS}>Last Name</label>
            <input className={INPUT_CLS} value={form.admin_last_name} onChange={(e) => set("admin_last_name", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLS}>Employee ID *</label>
            <input className={`${INPUT_CLS} font-mono`} value={form.admin_employee_code} onChange={(e) => set("admin_employee_code", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLS}>Password * <span className="font-normal normal-case text-slate-400">(min 6 characters)</span></label>
            <input type="text" className={`${INPUT_CLS} font-mono`} value={form.admin_password} onChange={(e) => set("admin_password", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLS}>Contact Email</label>
            <input className={INPUT_CLS} value={form.admin_email} onChange={(e) => set("admin_email", e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLS}>Mobile</label>
            <input className={INPUT_CLS} value={form.admin_mobile} onChange={(e) => set("admin_mobile", e.target.value)} />
          </div>
        </div>
      </div>

      <div className={SECTION_CLS}>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <input type="checkbox" checked={form.issueLicenseNow} onChange={(e) => set("issueLicenseNow", e.target.checked)} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400" />
          Issue a License right now
        </label>
        <p className="text-xs text-slate-400">Optional — skip this and assign it later from Company Licenses if you're not ready yet.</p>

        {form.issueLicenseNow && (
          <div className="space-y-3 border-t pt-3">
            <div>
              <label className={LABEL_CLS}>Plan *</label>
              <select className={INPUT_CLS} value={form.plan_id} onChange={(e) => set("plan_id", e.target.value)}>
                <option value="">Select a plan…</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.plan_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Start Date</label>
                <input type="date" className={INPUT_CLS} value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLS}>End Date *</label>
                <input type="date" className={INPUT_CLS} value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Billing Cycle</label>
                <select className={INPUT_CLS} value={form.billing_cycle} onChange={(e) => set("billing_cycle", e.target.value as BillingCycle)}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Grace Period (days)</label>
                <input type="number" min={0} className={INPUT_CLS} value={form.grace_period_days} onChange={(e) => set("grace_period_days", Number(e.target.value))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.auto_renew} onChange={(e) => set("auto_renew", e.target.checked)} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400" />
              Auto-renew
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.is_complimentary} onChange={(e) => set("is_complimentary", e.target.checked)} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400" />
              Free / Complimentary — no payment expected from this company
            </label>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <PrimaryButton onClick={handleSubmit} disabled={saving || !canSubmit}>
          {saving ? <IconSpinner className="h-3.5 w-3.5" /> : null} {saving ? "Creating…" : "Create Company"}
        </PrimaryButton>
      </div>
    </div>
  );
}
