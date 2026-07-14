import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadCertificates,
  createCertificate,
  saveCertificate,
  removeCertificate,
  togglePublished,
  toggleActive,
} from "../../services/certificate/certificateService";
import { loadAssessments } from "../../services/assessment/assessmentService";
import { employeeService } from "../../services/employee/employeeService";

import type { Certificate, CertificateForm } from "../../types/certificate";
import type { Assessment } from "../../types/assessment";
import type { Employee } from "../../types/employee";
import { defaultCertificateForm } from "../../types/certificate";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function findName<T extends { id: string }>(
  list: T[],
  id: string,
  key: keyof T
): string {
  if (!id) return "—";
  const m = list.find((x) => x.id === id);
  return m ? String(m[key]) : "—";
}

function employeeFullName(employees: Employee[], id: string): string {
  if (!id) return "—";
  const emp = employees.find((e) => e.id === id);
  if (!emp) return "—";
  return (
    [emp.first_name, emp.last_name].filter(Boolean).join(" ") || emp.employee_code
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

const CLS_INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:bg-slate-50";

const CLS_SELECT =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:bg-slate-50";

const CLS_TEXTAREA =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:bg-slate-50 resize-none";

function FL({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "bg-yellow-500" : "bg-slate-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  sub,
  on,
  onChange,
  disabled,
}: {
  label: string;
  sub: string;
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <Toggle on={on} onChange={onChange} disabled={disabled} />
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
    </label>
  );
}

function Pill({
  on,
  onLabel,
  offLabel,
  onCls,
  offCls,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  onCls: string;
  offCls: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        on ? onCls : offCls
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          on ? "bg-current opacity-80" : "bg-slate-400"
        }`}
      />
      {on ? onLabel : offLabel}
    </span>
  );
}

function Spinner({ spin }: { spin: boolean }) {
  return (
    <svg
      className={`h-4 w-4 ${spin ? "animate-spin" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton / Empty / Delete dialog
// ─────────────────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-10 w-8 rounded bg-slate-100" />
          <div className="h-10 flex-1 rounded bg-slate-100" />
          <div className="h-10 w-28 rounded bg-slate-100" />
          <div className="h-10 w-24 rounded bg-slate-100" />
          <div className="h-10 w-20 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ search, onAdd }: { search: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <svg
          className="h-8 w-8 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-1.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5"
          />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No certificates found" : "No certificates yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search
          ? `No results for "${search}".`
          : "Add certificates to recognise employee achievements."}
      </p>
      {!search && (
        <button
          onClick={onAdd}
          className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
        >
          Add Certificate
        </button>
      )}
    </div>
  );
}

function DeleteDialog({
  name,
  busy,
  onConfirm,
  onCancel,
}: {
  name: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dd-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!busy ? onCancel : undefined}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h3 id="dd-title" className="mb-1 text-lg font-semibold text-slate-800">Delete Certificate</h3>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to delete certificate{" "}
          <span className="font-semibold text-slate-700">{name}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button ref={cancelRef} onClick={onCancel} disabled={busy}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 active:scale-95">
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Certificate form modal
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  certificate_no?: string;
  certificate_title?: string;
  issue_date?: string;
  expiry_date?: string;
}

function CertificateModal({
  editing,
  assessments,
  employees,
  usedNos,
  saving,
  onSave,
  onClose,
}: {
  editing: Certificate | null;
  assessments: Assessment[];
  employees: Employee[];
  usedNos: string[];
  saving: boolean;
  onSave: (data: CertificateForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<CertificateForm>(() =>
    isEdit
      ? {
          assessment_result_id: editing.assessment_result_id,
          employee_id:          editing.employee_id,
          assessment_id:        editing.assessment_id,
          certificate_no:       editing.certificate_no,
          certificate_title:    editing.certificate_title,
          issue_date:           editing.issue_date,
          expiry_date:          editing.expiry_date,
          certificate_url:      editing.certificate_url,
          qr_code_url:          editing.qr_code_url,
          template_name:        editing.template_name,
          generated:            editing.generated,
          published:            editing.published,
          active:               editing.active,
          remarks:              editing.remarks,
        }
      : { ...defaultCertificateForm }
  );

  const [errs, setErrs] = useState<FormErrs>({});
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  function field<K extends keyof CertificateForm>(key: K, val: CertificateForm[K]) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.certificate_no.trim()) {
      e.certificate_no = "Certificate Number is required.";
    } else {
      const no = form.certificate_no.trim().toLowerCase();
      const dup = usedNos.includes(no) &&
        (!isEdit || no !== editing.certificate_no.trim().toLowerCase());
      if (dup) e.certificate_no = "Certificate Number already exists.";
    }

    if (!form.certificate_title.trim()) {
      e.certificate_title = "Certificate Title is required.";
    }

    if (!form.issue_date) {
      e.issue_date = "Issue Date is required.";
    }

    if (form.expiry_date && form.expiry_date < form.issue_date) {
      e.expiry_date = "Expiry Date cannot be earlier than Issue Date.";
    }

    setErrs(e);
    return Object.keys(e).length === 0;
  }

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!validate()) return;
    onSave(form);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-form-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="cert-form-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Certificate" : "Add Certificate"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update certificate details." : "Enter certificate details below."}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="space-y-5 p-6">

            {/* ── Identity ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Identity</p>

            <FL label="Certificate Number" required error={errs.certificate_no}>
              <input
                ref={firstRef}
                type="text"
                value={form.certificate_no}
                onChange={(e) => field("certificate_no", e.target.value)}
                placeholder="e.g. CERT-2025-001"
                maxLength={50}
                disabled={saving}
                className={CLS_INPUT}
              />
            </FL>

            <FL label="Certificate Title" required error={errs.certificate_title}>
              <input
                type="text"
                value={form.certificate_title}
                onChange={(e) => field("certificate_title", e.target.value)}
                placeholder="e.g. Certificate of Achievement"
                maxLength={200}
                disabled={saving}
                className={CLS_INPUT}
              />
            </FL>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Employee">
                <select
                  value={form.employee_id}
                  onChange={(e) => field("employee_id", e.target.value)}
                  disabled={saving}
                  className={CLS_SELECT}
                >
                  <option value="">— Select Employee —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {[e.first_name, e.last_name].filter(Boolean).join(" ")} — {e.employee_code}
                    </option>
                  ))}
                </select>
              </FL>

              <FL label="Assessment">
                <select
                  value={form.assessment_id}
                  onChange={(e) => field("assessment_id", e.target.value)}
                  disabled={saving}
                  className={CLS_SELECT}
                >
                  <option value="">— Select Assessment —</option>
                  {assessments.map((a) => (
                    <option key={a.id} value={a.id}>{a.assessment_title}</option>
                  ))}
                </select>
              </FL>
            </div>

            <FL label="Assessment Result ID">
              <input
                type="text"
                value={form.assessment_result_id}
                onChange={(e) => field("assessment_result_id", e.target.value)}
                placeholder="UUID of the assessment result"
                disabled={saving}
                className={CLS_INPUT}
              />
            </FL>

            {/* ── Dates ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dates</p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Issue Date" required error={errs.issue_date}>
                <input
                  type="date"
                  value={form.issue_date}
                  onChange={(e) => field("issue_date", e.target.value)}
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
              <FL label="Expiry Date" error={errs.expiry_date}>
                <input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => field("expiry_date", e.target.value)}
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
            </div>

            {/* ── Links ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Links &amp; Template</p>

            <FL label="Template Name">
              <input
                type="text"
                value={form.template_name}
                onChange={(e) => field("template_name", e.target.value)}
                placeholder="e.g. gold-border-v2"
                maxLength={100}
                disabled={saving}
                className={CLS_INPUT}
              />
            </FL>

            <FL label="Certificate URL">
              <input
                type="url"
                value={form.certificate_url}
                onChange={(e) => field("certificate_url", e.target.value)}
                placeholder="https://example.com/certificates/cert-001.pdf"
                disabled={saving}
                className={CLS_INPUT}
              />
            </FL>

            <FL label="QR Code URL">
              <input
                type="url"
                value={form.qr_code_url}
                onChange={(e) => field("qr_code_url", e.target.value)}
                placeholder="https://example.com/qr/cert-001.png"
                disabled={saving}
                className={CLS_INPUT}
              />
            </FL>

            {/* ── Status ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status</p>

            <div className="flex flex-wrap gap-y-4 gap-x-8 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <ToggleRow
                label="Generated"
                sub="Certificate file has been created"
                on={form.generated}
                onChange={() => field("generated", !form.generated)}
                disabled={saving}
              />
              <ToggleRow
                label="Published"
                sub="Visible to the employee"
                on={form.published}
                onChange={() => field("published", !form.published)}
                disabled={saving}
              />
              <ToggleRow
                label="Active"
                sub="Certificate is valid and active"
                on={form.active}
                onChange={() => field("active", !form.active)}
                disabled={saving}
              />
            </div>

            {/* ── Remarks ── */}
            <FL label="Remarks">
              <textarea
                value={form.remarks}
                onChange={(e) => field("remarks", e.target.value)}
                placeholder="Optional internal notes"
                rows={2}
                disabled={saving}
                className={CLS_TEXTAREA}
              />
            </FL>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:opacity-50 active:scale-95">
              {saving ? "Saving…" : isEdit ? "Update Certificate" : "Add Certificate"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

type ModalKind =
  | { type: "add" }
  | { type: "edit"; cert: Certificate }
  | { type: "delete"; cert: Certificate }
  | null;

export default function CertificateManagement() {

  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [assessments,  setAssessments]  = useState<Assessment[]>([]);
  const [employees,    setEmployees]    = useState<Employee[]>([]);

  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [deleting,        setDeleting]        = useState(false);
  const [togglingPubId,   setTogglingPubId]   = useState<string | null>(null);
  const [togglingActId,   setTogglingActId]   = useState<string | null>(null);

  const [search,           setSearch]           = useState("");
  const [assessmentFilter, setAssessmentFilter] = useState("");
  const [employeeFilter,   setEmployeeFilter]   = useState("");
  const [page,             setPage]             = useState(1);
  const [banner,           setBanner]           = useState("");
  const [modal,            setModal]            = useState<ModalKind>(null);

  const addBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  // ── Derived
  const usedNos = useMemo(
    () => certificates.map((c) => c.certificate_no.trim().toLowerCase()),
    [certificates]
  );

  const filtered = useMemo(() => {
    let rows = certificates;

    if (assessmentFilter) rows = rows.filter((c) => c.assessment_id === assessmentFilter);
    if (employeeFilter)   rows = rows.filter((c) => c.employee_id === employeeFilter);

    const kw = search.trim().toLowerCase();
    if (kw) {
      rows = rows.filter((c) =>
        c.certificate_no.toLowerCase().includes(kw) ||
        c.certificate_title.toLowerCase().includes(kw) ||
        (c.template_name ?? "").toLowerCase().includes(kw) ||
        employeeFullName(employees, c.employee_id).toLowerCase().includes(kw)
      );
    }

    return rows;
  }, [certificates, assessments, employees, search, assessmentFilter, employeeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PER_PAGE;
  const pageRows   = filtered.slice(pageStart, pageStart + PER_PAGE);

  useEffect(() => { setPage(1); }, [search, assessmentFilter, employeeFilter]);

  // ── Load
  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      const [certData, asmData, empData] = await Promise.all([
        loadCertificates(),
        loadAssessments(),
        employeeService.getAll(),
      ]);
      setCertificates(certData);
      setAssessments(asmData);
      setEmployees(empData);
    } catch (err) {
      console.error(err);
      setBanner("Failed to load data. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Modal helpers
  function openModal(m: ModalKind) {
    openerRef.current = document.activeElement;
    setModal(m);
  }

  function closeModal() {
    setModal(null);
    setTimeout(() => {
      const el = openerRef.current;
      openerRef.current = null;
      if (el instanceof HTMLElement) el.focus();
      else addBtnRef.current?.focus();
    }, 0);
  }

  // ── Save
  const handleSave = useCallback(
    async (data: CertificateForm) => {
      setSaving(true);
      try {
        if (modal?.type === "edit") {
          await saveCertificate(modal.cert.id, data);
        } else {
          await createCertificate(data);
        }
        await load();
        setBanner("");
        closeModal();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Unable to save certificate.");
      } finally {
        setSaving(false);
      }
    },
    [modal, load]
  );

  // ── Delete
  async function handleDelete() {
    if (modal?.type !== "delete") return;
    setDeleting(true);
    try {
      await removeCertificate(modal.cert.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to delete certificate.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle published — optimistic
  async function handleTogglePublished(cert: Certificate) {
    setTogglingPubId(cert.id);
    try {
      await togglePublished(cert.id, !cert.published);
      setCertificates((prev) =>
        prev.map((c) => c.id === cert.id ? { ...c, published: !cert.published } : c)
      );
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to update published status.");
      await load();
    } finally {
      setTogglingPubId(null);
    }
  }

  // ── Toggle active — optimistic
  async function handleToggleActive(cert: Certificate) {
    setTogglingActId(cert.id);
    try {
      await toggleActive(cert.id, !cert.active);
      setCertificates((prev) =>
        prev.map((c) => c.id === cert.id ? { ...c, active: !cert.active } : c)
      );
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to update active status.");
      await load();
    } finally {
      setTogglingActId(null);
    }
  }

  // ── Render
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Certificate Management</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage and publish assessment certificates for employees.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => load()} disabled={loading} aria-label="Refresh"
            className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50">
            <Spinner spin={loading} />
          </button>
          <button ref={addBtnRef} onClick={() => openModal({ type: "add" })}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Certificate
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 border-b border-slate-100 px-6 py-4">
        <div className="relative min-w-[220px] flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by number, title, employee…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-yellow-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/30" />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <select value={assessmentFilter} onChange={(e) => setAssessmentFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30">
          <option value="">All Assessments</option>
          {assessments.map((a) => <option key={a.id} value={a.id}>{a.assessment_title}</option>)}
        </select>

        <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30">
          <option value="">All Employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {[e.first_name, e.last_name].filter(Boolean).join(" ")} — {e.employee_code}
            </option>
          ))}
        </select>

        {!loading && (
          <p className="self-center text-sm text-slate-400">
            {filtered.length} {filtered.length === 1 ? "certificate" : "certificates"}
          </p>
        )}
      </div>

      {/* Error banner */}
      {banner && (
        <div className="mx-6 mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="flex-1">{banner}</p>
          <button onClick={() => setBanner("")} aria-label="Dismiss" className="text-red-400 hover:text-red-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Content */}
      <div className="px-6 py-4">
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState search={search} onAdd={() => openModal({ type: "add" })} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    { h: "#",            cls: "w-10 text-left" },
                    { h: "Cert No",      cls: "text-left"      },
                    { h: "Title",        cls: "text-left"      },
                    { h: "Employee",     cls: "text-left"      },
                    { h: "Assessment",   cls: "text-left"      },
                    { h: "Issue Date",   cls: "text-left"      },
                    { h: "Expiry",       cls: "text-left"      },
                    { h: "Generated",    cls: "text-center"    },
                    { h: "Published",    cls: "text-center"    },
                    { h: "Active",       cls: "text-center"    },
                    { h: "Actions",      cls: "text-right"     },
                  ].map(({ h, cls }) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.map((cert, i) => {
                  const busyPub = togglingPubId === cert.id;
                  const busyAct = togglingActId === cert.id;
                  const busy    = busyPub || busyAct;
                  return (
                    <tr key={cert.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">{pageStart + i + 1}</td>

                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                        {cert.certificate_no}
                      </td>

                      <td className="px-4 py-3">
                        <p className="max-w-[180px] truncate font-semibold text-slate-800">
                          {cert.certificate_title}
                        </p>
                        {cert.template_name && (
                          <p className="mt-0.5 text-xs text-slate-400">{cert.template_name}</p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {employeeFullName(employees, cert.employee_id)}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {findName(assessments, cert.assessment_id, "assessment_title")}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {cert.issue_date || "—"}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {cert.expiry_date || "—"}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          cert.generated
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            : "bg-slate-100 text-slate-400 ring-1 ring-slate-200"
                        }`}>
                          {cert.generated ? "Yes" : "No"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleTogglePublished(cert)}
                          disabled={busy}
                          aria-label="Toggle published"
                          className="disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Pill
                            on={cert.published}
                            onLabel="Published"
                            offLabel="Draft"
                            onCls="bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                            offCls="bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                          />
                        </button>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(cert)}
                          disabled={busy}
                          aria-label="Toggle active"
                          className="disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Pill
                            on={cert.active}
                            onLabel="Active"
                            offLabel="Inactive"
                            onCls="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            offCls="bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                          />
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal({ type: "edit", cert })}
                            disabled={busy}
                            aria-label="Edit certificate"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openModal({ type: "delete", cert })}
                            disabled={busy}
                            aria-label="Delete certificate"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-sm text-slate-500">Page {safePage} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
              Previous
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {(modal?.type === "add" || modal?.type === "edit") && (
        <CertificateModal
          editing={modal.type === "edit" ? modal.cert : null}
          assessments={assessments}
          employees={employees}
          usedNos={usedNos}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {modal?.type === "delete" && (
        <DeleteDialog
          name={modal.cert.certificate_no}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
  );
}
