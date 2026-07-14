import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadVerifications,
  createVerification,
  saveVerification,
  removeVerification,
  toggleActive,
  incrementVerificationCount,
} from "../../services/certificateVerification/certificateVerificationService";
import { loadCertificates } from "../../services/certificate/certificateService";

import type {
  CertificateVerification,
  CertificateVerificationForm,
  VerificationStatus,
} from "../../types/certificateVerification";
import type { Certificate } from "../../types/certificate";
import { defaultVerificationForm } from "../../types/certificateVerification";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

const STATUSES: { value: VerificationStatus; label: string }[] = [
  { value: "active",  label: "Active"  },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
];

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

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function statusCls(s: VerificationStatus): string {
  const map: Record<VerificationStatus, string> = {
    active:  "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    expired: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    revoked: "bg-red-50 text-red-700 ring-1 ring-red-200",
  };
  return map[s];
}

function statusDot(s: VerificationStatus): string {
  const map: Record<VerificationStatus, string> = {
    active:  "bg-emerald-500",
    expired: "bg-amber-500",
    revoked: "bg-red-500",
  };
  return map[s];
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

const CLS_INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:bg-slate-50";

const CLS_SELECT =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:bg-slate-50";

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

function Spinner({ spin }: { spin: boolean }) {
  return (
    <svg className={`h-4 w-4 ${spin ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
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
        </div>
      ))}
    </div>
  );
}

function EmptyState({ search, onAdd }: { search: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No verifications found" : "No verifications yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search ? `No results for "${search}".` : "Add a verification record for a certificate."}
      </p>
      {!search && (
        <button onClick={onAdd} className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95">
          Add Verification
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="dd-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!busy ? onCancel : undefined} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h3 id="dd-title" className="mb-1 text-lg font-semibold text-slate-800">Delete Verification</h3>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to delete verification <span className="font-semibold text-slate-700">{name}</span>? This cannot be undone.
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
// Verification form modal
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  certificate_id?: string;
  verification_code?: string;
  verification_status?: string;
  verified_count?: string;
  expires_at?: string;
}

function VerificationModal({
  editing,
  certificates,
  usedCodes,
  saving,
  onSave,
  onClose,
}: {
  editing: CertificateVerification | null;
  certificates: Certificate[];
  usedCodes: string[];
  saving: boolean;
  onSave: (data: CertificateVerificationForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<CertificateVerificationForm>(() =>
    isEdit
      ? {
          certificate_id:      editing.certificate_id,
          verification_code:   editing.verification_code,
          verification_url:    editing.verification_url,
          qr_code_url:         editing.qr_code_url,
          verification_status: editing.verification_status,
          verified_count:      editing.verified_count,
          last_verified_at:    editing.last_verified_at,
          expires_at:          editing.expires_at,
          active:              editing.active,
        }
      : { ...defaultVerificationForm }
  );

  const [errs, setErrs] = useState<FormErrs>({});
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  function field<K extends keyof CertificateVerificationForm>(
    key: K,
    val: CertificateVerificationForm[K]
  ) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.verification_code.trim()) {
      e.verification_code = "Verification Code is required.";
    } else {
      const code = form.verification_code.trim().toLowerCase();
      const dup = usedCodes.includes(code) &&
        (!isEdit || code !== editing.verification_code.trim().toLowerCase());
      if (dup) e.verification_code = "Verification Code already exists.";
    }

    if (!["active", "expired", "revoked"].includes(form.verification_status)) {
      e.verification_status = "Status must be active, expired, or revoked.";
    }

    if (form.verified_count < 0) {
      e.verified_count = "Verified Count cannot be negative.";
    }

    if (form.expires_at) {
      const today = new Date().toISOString().slice(0, 10);
      if (form.expires_at < today) {
        e.expires_at = "Expiry Date must not be earlier than today.";
      }
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
      aria-labelledby="cv-form-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="cv-form-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Verification" : "Add Verification"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update verification details." : "Create a verification record for a certificate."}
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

            <FL label="Certificate">
              <select ref={firstRef} value={form.certificate_id}
                onChange={(e) => field("certificate_id", e.target.value)}
                disabled={saving} className={CLS_SELECT}>
                <option value="">— Select Certificate —</option>
                {certificates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.certificate_no} — {c.certificate_title}
                  </option>
                ))}
              </select>
            </FL>

            <FL label="Verification Code" required error={errs.verification_code}>
              <input type="text" value={form.verification_code}
                onChange={(e) => field("verification_code", e.target.value)}
                placeholder="e.g. VRF-2025-001ABC"
                maxLength={80} disabled={saving} className={CLS_INPUT} />
            </FL>

            {/* ── URLs ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">URLs</p>

            <FL label="Verification URL">
              <input type="url" value={form.verification_url}
                onChange={(e) => field("verification_url", e.target.value)}
                placeholder="https://example.com/verify/VRF-001"
                disabled={saving} className={CLS_INPUT} />
            </FL>

            <FL label="QR Code URL">
              <input type="url" value={form.qr_code_url}
                onChange={(e) => field("qr_code_url", e.target.value)}
                placeholder="https://example.com/qr/VRF-001.png"
                disabled={saving} className={CLS_INPUT} />
            </FL>

            {/* ── Status & Counts ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status &amp; Counts</p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <FL label="Verification Status" required error={errs.verification_status}>
                <select value={form.verification_status}
                  onChange={(e) => field("verification_status", e.target.value as VerificationStatus)}
                  disabled={saving} className={CLS_SELECT}>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </FL>

              <FL label="Verified Count" error={errs.verified_count}>
                <input type="number" min={0} value={form.verified_count}
                  onChange={(e) =>
                    field("verified_count", Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  disabled={saving} className={CLS_INPUT} />
              </FL>

              <FL label="Expiry Date" error={errs.expires_at}>
                <input type="date"
                  value={form.expires_at ? form.expires_at.slice(0, 10) : ""}
                  onChange={(e) => field("expires_at", e.target.value || null)}
                  disabled={saving} className={CLS_INPUT} />
              </FL>
            </div>

            {/* ── Active ── */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <ToggleRow
                label="Active"
                sub="Verification record is valid and in use"
                on={form.active}
                onChange={() => field("active", !form.active)}
                disabled={saving}
              />
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:opacity-50 active:scale-95">
              {saving ? "Saving…" : isEdit ? "Update Verification" : "Add Verification"}
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
  | { type: "edit"; verification: CertificateVerification }
  | { type: "delete"; verification: CertificateVerification }
  | null;

export default function CertificateVerificationManagement() {

  const [verifications, setVerifications] = useState<CertificateVerification[]>([]);
  const [certificates,  setCertificates]  = useState<Certificate[]>([]);

  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [togglingActId, setTogglingActId] = useState<string | null>(null);
  const [incrementingId,setIncrementingId]= useState<string | null>(null);

  const [search,           setSearch]           = useState("");
  const [certFilter,       setCertFilter]       = useState("");
  const [statusFilter,     setStatusFilter]     = useState<VerificationStatus | "">("");
  const [page,             setPage]             = useState(1);
  const [banner,           setBanner]           = useState("");
  const [modal,            setModal]            = useState<ModalKind>(null);

  const addBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  // ── Derived
  const usedCodes = useMemo(
    () => verifications.map((v) => v.verification_code.trim().toLowerCase()),
    [verifications]
  );

  const filtered = useMemo(() => {
    let rows = verifications;
    if (certFilter)   rows = rows.filter((v) => v.certificate_id       === certFilter);
    if (statusFilter) rows = rows.filter((v) => v.verification_status  === statusFilter);
    const kw = search.trim().toLowerCase();
    if (kw) {
      rows = rows.filter((v) =>
        v.verification_code.toLowerCase().includes(kw) ||
        (v.verification_url ?? "").toLowerCase().includes(kw) ||
        v.verification_status.toLowerCase().includes(kw)
      );
    }
    return rows;
  }, [verifications, certFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PER_PAGE;
  const pageRows   = filtered.slice(pageStart, pageStart + PER_PAGE);

  useEffect(() => { setPage(1); }, [search, certFilter, statusFilter]);

  // ── Load
  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      const [vData, cData] = await Promise.all([
        loadVerifications(),
        loadCertificates(),
      ]);
      setVerifications(vData);
      setCertificates(cData);
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
    async (data: CertificateVerificationForm) => {
      setSaving(true);
      try {
        if (modal?.type === "edit") {
          await saveVerification(modal.verification.id, data);
        } else {
          await createVerification(data);
        }
        await load();
        setBanner("");
        closeModal();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Unable to save verification.");
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
      await removeVerification(modal.verification.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to delete verification.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle active — optimistic
  async function handleToggleActive(v: CertificateVerification) {
    setTogglingActId(v.id);
    try {
      await toggleActive(v.id, !v.active);
      setVerifications((prev) =>
        prev.map((r) => r.id === v.id ? { ...r, active: !v.active } : r)
      );
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to update status.");
      await load();
    } finally {
      setTogglingActId(null);
    }
  }

  // ── Increment verified count — optimistic
  async function handleIncrement(v: CertificateVerification) {
    setIncrementingId(v.id);
    try {
      const updated = await incrementVerificationCount(v.id);
      setVerifications((prev) =>
        prev.map((r) => r.id === v.id ? updated : r)
      );
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to increment count.");
    } finally {
      setIncrementingId(null);
    }
  }

  // ── Render
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Certificate Verifications</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage verification codes and status for issued certificates.
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
            Add Verification
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
            placeholder="Search by code, URL, status…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-yellow-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/30" />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <select value={certFilter} onChange={(e) => setCertFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30">
          <option value="">All Certificates</option>
          {certificates.map((c) => (
            <option key={c.id} value={c.id}>{c.certificate_no} — {c.certificate_title}</option>
          ))}
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as VerificationStatus | "")}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30">
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {!loading && (
          <p className="self-center text-sm text-slate-400">
            {filtered.length} {filtered.length === 1 ? "record" : "records"}
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
                    { h: "#",              cls: "w-10 text-left" },
                    { h: "Verification Code", cls: "text-left"  },
                    { h: "Certificate",    cls: "text-left"      },
                    { h: "Status",         cls: "text-center"    },
                    { h: "Verified",       cls: "text-center"    },
                    { h: "Last Verified",  cls: "text-left"      },
                    { h: "Expires",        cls: "text-left"      },
                    { h: "Active",         cls: "text-center"    },
                    { h: "Actions",        cls: "text-right"     },
                  ].map(({ h, cls }) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.map((v, i) => {
                  const busyAct = togglingActId  === v.id;
                  const busyInc = incrementingId === v.id;
                  const busy    = busyAct || busyInc;
                  return (
                    <tr key={v.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">{pageStart + i + 1}</td>

                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                        {v.verification_code}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {findName(certificates, v.certificate_id, "certificate_no")}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCls(v.verification_status)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDot(v.verification_status)}`} />
                          {v.verification_status.charAt(0).toUpperCase() + v.verification_status.slice(1)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-medium text-slate-700">{v.verified_count}</span>
                          <button
                            onClick={() => handleIncrement(v)}
                            disabled={busy}
                            aria-label="Increment verification count"
                            title="Record a verification"
                            className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busyInc ? (
                              <Spinner spin />
                            ) : (
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(v.last_verified_at)}</td>

                      <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(v.expires_at)}</td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(v)}
                          disabled={busy}
                          aria-label="Toggle active"
                          className="disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            v.active
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${v.active ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {v.active ? "Active" : "Inactive"}
                          </span>
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal({ type: "edit", verification: v })}
                            disabled={busy}
                            aria-label="Edit verification"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openModal({ type: "delete", verification: v })}
                            disabled={busy}
                            aria-label="Delete verification"
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
        <VerificationModal
          editing={modal.type === "edit" ? modal.verification : null}
          certificates={certificates}
          usedCodes={usedCodes}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {modal?.type === "delete" && (
        <DeleteDialog
          name={modal.verification.verification_code}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
  );
}
