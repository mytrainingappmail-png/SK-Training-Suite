import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadQueue,
  createQueueItem,
  saveQueueItem,
  removeQueueItem,
  retryGeneration,
} from "../../services/certificateGeneration/certificateGenerationService";
import { loadCertificates } from "../../services/certificate/certificateService";
import { loadTemplates } from "../../services/certificateTemplate/certificateTemplateService";
import { employeeService } from "../../services/employee/employeeService";

import type {
  CertificateGenerationQueueItem,
  CertificateGenerationQueueForm,
  GenerationStatus,
} from "../../types/certificateGeneration";
import type { Certificate } from "../../types/certificate";
import type { CertificateTemplate } from "../../types/certificateTemplate";
import type { Employee } from "../../types/employee";
import { defaultQueueItemForm } from "../../types/certificateGeneration";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

const STATUSES: { value: GenerationStatus; label: string }[] = [
  { value: "pending",    label: "Pending"    },
  { value: "processing", label: "Processing" },
  { value: "completed",  label: "Completed"  },
  { value: "failed",     label: "Failed"     },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function employeeFullName(employees: Employee[], id: string): string {
  if (!id) return "—";
  const emp = employees.find((e) => e.id === id);
  if (!emp) return "—";
  return [emp.first_name, emp.last_name].filter(Boolean).join(" ") || emp.employee_code;
}

function findName<T extends { id: string }>(list: T[], id: string, key: keyof T): string {
  if (!id) return "—";
  const m = list.find((x) => x.id === id);
  return m ? String(m[key]) : "—";
}

function statusCls(s: GenerationStatus): string {
  const map: Record<GenerationStatus, string> = {
    pending:    "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    processing: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    completed:  "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    failed:     "bg-red-50 text-red-700 ring-1 ring-red-200",
  };
  return map[s] ?? "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
}

function statusDot(s: GenerationStatus): string {
  const map: Record<GenerationStatus, string> = {
    pending:    "bg-slate-400",
    processing: "bg-amber-500",
    completed:  "bg-emerald-500",
    failed:     "bg-red-500",
  };
  return map[s] ?? "bg-slate-400";
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No queue items found" : "Queue is empty"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search ? `No results for "${search}".` : "Add an item to the generation queue."}
      </p>
      {!search && (
        <button onClick={onAdd} className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95">
          Add to Queue
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
        <h3 id="dd-title" className="mb-1 text-lg font-semibold text-slate-800">Remove Queue Item</h3>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to remove the queue item for <span className="font-semibold text-slate-700">{name}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button ref={cancelRef} onClick={onCancel} disabled={busy}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 active:scale-95">
            {busy ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue item form modal
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  employee_id?: string;
  assessment_result_id?: string;
  certificate_id?: string;
  template_id?: string;
  status?: string;
  priority?: string;
  retry_count?: string;
}

function QueueItemModal({
  editing,
  employees,
  certificates,
  templates,
  saving,
  onSave,
  onClose,
}: {
  editing: CertificateGenerationQueueItem | null;
  employees: Employee[];
  certificates: Certificate[];
  templates: CertificateTemplate[];
  saving: boolean;
  onSave: (data: CertificateGenerationQueueForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<CertificateGenerationQueueForm>(() =>
    isEdit
      ? {
          assessment_result_id: editing.assessment_result_id,
          certificate_id:       editing.certificate_id,
          template_id:          editing.template_id,
          employee_id:          editing.employee_id,
          status:               editing.status,
          priority:             editing.priority,
          retry_count:          editing.retry_count,
          requested_at:         editing.requested_at,
          started_at:           editing.started_at,
          completed_at:         editing.completed_at,
          error_message:        editing.error_message,
        }
      : {
          ...defaultQueueItemForm,
          requested_at: new Date().toISOString().slice(0, 16),
        }
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

  function field<K extends keyof CertificateGenerationQueueForm>(
    key: K,
    val: CertificateGenerationQueueForm[K]
  ) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.employee_id)              e.employee_id          = "Employee is required.";
    if (!form.assessment_result_id.trim()) e.assessment_result_id = "Assessment Result ID is required.";
    if (!form.certificate_id.trim())    e.certificate_id       = "Certificate is required.";
    if (!form.template_id.trim())       e.template_id          = "Template is required.";

    const allowed: GenerationStatus[] = ["pending", "processing", "completed", "failed"];
    if (!allowed.includes(form.status)) {
      e.status = `Status must be one of: ${allowed.join(", ")}.`;
    }

    if (form.priority < 1)     e.priority     = "Priority must be greater than zero.";
    if (form.retry_count < 0)  e.retry_count  = "Retry Count cannot be negative.";

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
      aria-labelledby="qm-form-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="qm-form-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Queue Item" : "Add to Queue"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update queue item details." : "Add a new certificate generation request."}
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

            {/* ── References ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">References</p>

            <FL label="Employee" required error={errs.employee_id}>
              <select ref={firstRef} value={form.employee_id}
                onChange={(e) => field("employee_id", e.target.value)}
                disabled={saving} className={CLS_SELECT}>
                <option value="">— Select Employee —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {[e.first_name, e.last_name].filter(Boolean).join(" ")} — {e.employee_code}
                  </option>
                ))}
              </select>
            </FL>

            <FL label="Certificate" required error={errs.certificate_id}>
              <select value={form.certificate_id}
                onChange={(e) => field("certificate_id", e.target.value)}
                disabled={saving} className={CLS_SELECT}>
                <option value="">— Select Certificate —</option>
                {certificates.map((c) => (
                  <option key={c.id} value={c.id}>{c.certificate_no} — {c.certificate_title}</option>
                ))}
              </select>
            </FL>

            <FL label="Template" required error={errs.template_id}>
              <select value={form.template_id}
                onChange={(e) => field("template_id", e.target.value)}
                disabled={saving} className={CLS_SELECT}>
                <option value="">— Select Template —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.template_name}</option>
                ))}
              </select>
            </FL>

            <FL label="Assessment Result ID" required error={errs.assessment_result_id}>
              <input type="text" value={form.assessment_result_id}
                onChange={(e) => field("assessment_result_id", e.target.value)}
                placeholder="UUID of the assessment result"
                disabled={saving} className={CLS_INPUT} />
            </FL>

            {/* ── Queue Settings ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Queue Settings</p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <FL label="Status" required error={errs.status}>
                <select value={form.status}
                  onChange={(e) => field("status", e.target.value as GenerationStatus)}
                  disabled={saving} className={CLS_SELECT}>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </FL>

              <FL label="Priority" required error={errs.priority}>
                <input type="number" min={1} value={form.priority}
                  onChange={(e) => field("priority", Math.max(1, parseInt(e.target.value, 10) || 1))}
                  disabled={saving} className={CLS_INPUT} />
              </FL>

              <FL label="Retry Count" error={errs.retry_count}>
                <input type="number" min={0} value={form.retry_count}
                  onChange={(e) => field("retry_count", Math.max(0, parseInt(e.target.value, 10) || 0))}
                  disabled={saving} className={CLS_INPUT} />
              </FL>
            </div>

            {/* ── Timestamps ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Timestamps</p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <FL label="Requested At">
                <input type="datetime-local"
                  value={form.requested_at ? form.requested_at.slice(0, 16) : ""}
                  onChange={(e) => field("requested_at", e.target.value)}
                  disabled={saving} className={CLS_INPUT} />
              </FL>
              <FL label="Started At">
                <input type="datetime-local"
                  value={form.started_at ? form.started_at.slice(0, 16) : ""}
                  onChange={(e) => field("started_at", e.target.value || null)}
                  disabled={saving} className={CLS_INPUT} />
              </FL>
              <FL label="Completed At">
                <input type="datetime-local"
                  value={form.completed_at ? form.completed_at.slice(0, 16) : ""}
                  onChange={(e) => field("completed_at", e.target.value || null)}
                  disabled={saving} className={CLS_INPUT} />
              </FL>
            </div>

            {/* ── Error Message ── */}
            <FL label="Error Message">
              <textarea value={form.error_message}
                onChange={(e) => field("error_message", e.target.value)}
                placeholder="Error details if generation failed"
                rows={2} disabled={saving} className={CLS_TEXTAREA} />
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
              {saving ? "Saving…" : isEdit ? "Update Item" : "Add to Queue"}
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
  | { type: "edit"; item: CertificateGenerationQueueItem }
  | { type: "delete"; item: CertificateGenerationQueueItem }
  | null;

export default function CertificateGenerationManagement() {

  const [queue,        setQueue]        = useState<CertificateGenerationQueueItem[]>([]);
  const [employees,    setEmployees]    = useState<Employee[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [templates,    setTemplates]    = useState<CertificateTemplate[]>([]);

  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [retryingId,  setRetryingId]  = useState<string | null>(null);

  const [search,          setSearch]          = useState("");
  const [statusFilter,    setStatusFilter]    = useState<GenerationStatus | "">("");
  const [employeeFilter,  setEmployeeFilter]  = useState("");
  const [templateFilter,  setTemplateFilter]  = useState("");
  const [page,            setPage]            = useState(1);
  const [banner,          setBanner]          = useState("");
  const [modal,           setModal]           = useState<ModalKind>(null);

  const addBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  // ── Derived
  const filtered = useMemo(() => {
    let rows = queue;

    if (statusFilter)   rows = rows.filter((r) => r.status      === statusFilter);
    if (employeeFilter) rows = rows.filter((r) => r.employee_id  === employeeFilter);
    if (templateFilter) rows = rows.filter((r) => r.template_id  === templateFilter);

    const kw = search.trim().toLowerCase();
    if (kw) {
      rows = rows.filter((r) =>
        employeeFullName(employees, r.employee_id).toLowerCase().includes(kw) ||
        (r.error_message ?? "").toLowerCase().includes(kw) ||
        r.status.toLowerCase().includes(kw)
      );
    }

    return rows;
  }, [queue, employees, search, statusFilter, employeeFilter, templateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PER_PAGE;
  const pageRows   = filtered.slice(pageStart, pageStart + PER_PAGE);

  useEffect(() => { setPage(1); }, [search, statusFilter, employeeFilter, templateFilter]);

  // ── Load
  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      const [qData, empData, certData, tmplData] = await Promise.all([
        loadQueue(),
        employeeService.getAll(),
        loadCertificates(),
        loadTemplates(),
      ]);
      setQueue(qData);
      setEmployees(empData);
      setCertificates(certData);
      setTemplates(tmplData);
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
    async (data: CertificateGenerationQueueForm) => {
      setSaving(true);
      try {
        if (modal?.type === "edit") {
          await saveQueueItem(modal.item.id, data);
        } else {
          await createQueueItem(data);
        }
        await load();
        setBanner("");
        closeModal();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Unable to save queue item.");
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
      await removeQueueItem(modal.item.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to remove queue item.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Retry
  async function handleRetry(item: CertificateGenerationQueueItem) {
    setRetryingId(item.id);
    try {
      const updated = await retryGeneration(item.id);
      setQueue((prev) => prev.map((q) => q.id === item.id ? updated : q));
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to retry.");
    } finally {
      setRetryingId(null);
    }
  }

  // ── Render
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Certificate Generation Queue</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Monitor and manage pending certificate generation requests.
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
            Add to Queue
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 border-b border-slate-100 px-6 py-4">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by employee, status, error…"
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

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as GenerationStatus | "")}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30">
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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

        <select value={templateFilter} onChange={(e) => setTemplateFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30">
          <option value="">All Templates</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.template_name}</option>)}
        </select>

        {!loading && (
          <p className="self-center text-sm text-slate-400">
            {filtered.length} {filtered.length === 1 ? "item" : "items"}
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
                    { h: "#",           cls: "w-10 text-left" },
                    { h: "Employee",    cls: "text-left"      },
                    { h: "Certificate", cls: "text-left"      },
                    { h: "Template",    cls: "text-left"      },
                    { h: "Status",      cls: "text-center"    },
                    { h: "Priority",    cls: "text-center"    },
                    { h: "Retries",     cls: "text-center"    },
                    { h: "Requested",   cls: "text-left"      },
                    { h: "Completed",   cls: "text-left"      },
                    { h: "Actions",     cls: "text-right"     },
                  ].map(({ h, cls }) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.map((item, i) => {
                  const isRetrying = retryingId === item.id;
                  const isFailed   = item.status === "failed";
                  return (
                    <tr key={item.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">{pageStart + i + 1}</td>

                      <td className="px-4 py-3 font-medium text-slate-800">
                        {employeeFullName(employees, item.employee_id)}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {findName(certificates, item.certificate_id, "certificate_no")}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {findName(templates, item.template_id, "template_name")}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCls(item.status)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDot(item.status)}`} />
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center text-slate-600">{item.priority}</td>

                      <td className="px-4 py-3 text-center text-slate-600">{item.retry_count}</td>

                      <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(item.requested_at)}</td>

                      <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(item.completed_at)}</td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Retry button — only for failed items */}
                          {isFailed && (
                            <button
                              onClick={() => handleRetry(item)}
                              disabled={isRetrying}
                              aria-label="Retry generation"
                              title={item.error_message || "Retry"}
                              className="rounded-lg p-1.5 text-amber-500 transition hover:bg-amber-50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {isRetrying ? (
                                <Spinner spin />
                              ) : (
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                              )}
                            </button>
                          )}

                          <button
                            onClick={() => openModal({ type: "edit", item })}
                            disabled={isRetrying}
                            aria-label="Edit queue item"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>

                          <button
                            onClick={() => openModal({ type: "delete", item })}
                            disabled={isRetrying}
                            aria-label="Remove queue item"
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
        <QueueItemModal
          editing={modal.type === "edit" ? modal.item : null}
          employees={employees}
          certificates={certificates}
          templates={templates}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {modal?.type === "delete" && (
        <DeleteDialog
          name={employeeFullName(employees, modal.item.employee_id)}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
  );
}
