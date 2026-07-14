import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadTemplates,
  createTemplate,
  saveTemplate,
  removeTemplate,
  toggleActive,
  setDefaultTemplate,
} from "../../services/certificateTemplate/certificateTemplateService";

import type {
  CertificateTemplate,
  CertificateTemplateForm,
  QrPosition,
  Orientation,
  PaperSize,
} from "../../types/certificateTemplate";
import { defaultCertificateTemplateForm } from "../../types/certificateTemplate";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

const QR_POSITIONS: { value: QrPosition; label: string }[] = [
  { value: "top_left",     label: "Top Left"     },
  { value: "top_right",    label: "Top Right"    },
  { value: "bottom_left",  label: "Bottom Left"  },
  { value: "bottom_right", label: "Bottom Right" },
  { value: "center",       label: "Center"       },
];

const ORIENTATIONS: { value: Orientation; label: string }[] = [
  { value: "landscape", label: "Landscape" },
  { value: "portrait",  label: "Portrait"  },
];

const PAPER_SIZES: { value: PaperSize; label: string }[] = [
  { value: "A4",     label: "A4"     },
  { value: "A3",     label: "A3"     },
  { value: "Letter", label: "Letter" },
  { value: "Legal",  label: "Legal"  },
];

const FONT_FAMILIES = [
  "Arial",
  "Times New Roman",
  "Georgia",
  "Helvetica",
  "Verdana",
  "Roboto",
  "Open Sans",
  "Montserrat",
];

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
        <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No templates found" : "No certificate templates yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search ? `No results for "${search}".` : "Add a template to define how certificates look."}
      </p>
      {!search && (
        <button onClick={onAdd} className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95">
          Add Template
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
        <h3 id="dd-title" className="mb-1 text-lg font-semibold text-slate-800">Delete Template</h3>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to delete <span className="font-semibold text-slate-700">{name}</span>? This cannot be undone.
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
// Template form modal
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  template_name?: string;
  template_code?: string;
  font_size?: string;
  default_template?: string;
}

function TemplateModal({
  editing,
  usedCodes,
  hasExistingDefault,
  saving,
  onSave,
  onClose,
}: {
  editing: CertificateTemplate | null;
  usedCodes: string[];
  hasExistingDefault: boolean;
  saving: boolean;
  onSave: (data: CertificateTemplateForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<CertificateTemplateForm>(() =>
    isEdit
      ? {
          template_name:        editing.template_name,
          template_code:        editing.template_code,
          description:          editing.description,
          background_image_url: editing.background_image_url,
          logo_url:             editing.logo_url,
          signature_url:        editing.signature_url,
          qr_position:          editing.qr_position,
          orientation:          editing.orientation,
          paper_size:           editing.paper_size,
          font_family:          editing.font_family,
          font_size:            editing.font_size,
          active:               editing.active,
          default_template:     editing.default_template,
        }
      : { ...defaultCertificateTemplateForm }
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

  function field<K extends keyof CertificateTemplateForm>(
    key: K,
    val: CertificateTemplateForm[K]
  ) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.template_name.trim()) {
      e.template_name = "Template Name is required.";
    }

    if (!form.template_code.trim()) {
      e.template_code = "Template Code is required.";
    } else {
      const code = form.template_code.trim().toLowerCase();
      const dup = usedCodes.includes(code) &&
        (!isEdit || code !== editing.template_code.trim().toLowerCase());
      if (dup) e.template_code = "Template Code already exists.";
    }

    if (form.font_size <= 0) {
      e.font_size = "Font Size must be greater than zero.";
    }

    if (
      form.default_template &&
      hasExistingDefault &&
      (!isEdit || !editing.default_template)
    ) {
      e.default_template = "Another template is already set as default. Unset it first, or use the Set Default action.";
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
      aria-labelledby="ct-form-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="ct-form-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Template" : "Add Template"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update certificate template settings." : "Define a new certificate template."}
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

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Template Name" required error={errs.template_name}>
                <input ref={firstRef} type="text" value={form.template_name}
                  onChange={(e) => field("template_name", e.target.value)}
                  placeholder="e.g. Gold Border Classic"
                  maxLength={100} disabled={saving} className={CLS_INPUT} />
              </FL>
              <FL label="Template Code" required error={errs.template_code}>
                <input type="text" value={form.template_code}
                  onChange={(e) => field("template_code", e.target.value)}
                  placeholder="e.g. TMPL-GOLD-001"
                  maxLength={50} disabled={saving} className={CLS_INPUT} />
              </FL>
            </div>

            <FL label="Description">
              <textarea value={form.description}
                onChange={(e) => field("description", e.target.value)}
                placeholder="Optional description of this template"
                rows={2} disabled={saving} className={CLS_TEXTAREA} />
            </FL>

            {/* ── Layout ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Layout</p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <FL label="Orientation">
                <select value={form.orientation}
                  onChange={(e) => field("orientation", e.target.value as Orientation)}
                  disabled={saving} className={CLS_SELECT}>
                  {ORIENTATIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </FL>
              <FL label="Paper Size">
                <select value={form.paper_size}
                  onChange={(e) => field("paper_size", e.target.value as PaperSize)}
                  disabled={saving} className={CLS_SELECT}>
                  {PAPER_SIZES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </FL>
              <FL label="QR Code Position">
                <select value={form.qr_position}
                  onChange={(e) => field("qr_position", e.target.value as QrPosition)}
                  disabled={saving} className={CLS_SELECT}>
                  {QR_POSITIONS.map((q) => (
                    <option key={q.value} value={q.value}>{q.label}</option>
                  ))}
                </select>
              </FL>
            </div>

            {/* ── Typography ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Typography</p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Font Family">
                <select value={form.font_family}
                  onChange={(e) => field("font_family", e.target.value)}
                  disabled={saving} className={CLS_SELECT}>
                  {FONT_FAMILIES.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </FL>
              <FL label="Font Size (pt)" required error={errs.font_size}>
                <input type="number" min={1} value={form.font_size}
                  onChange={(e) =>
                    field("font_size", Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  disabled={saving} className={CLS_INPUT} />
              </FL>
            </div>

            {/* ── Assets ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Asset URLs</p>

            <FL label="Background Image URL">
              <input type="url" value={form.background_image_url}
                onChange={(e) => field("background_image_url", e.target.value)}
                placeholder="https://example.com/bg.png"
                disabled={saving} className={CLS_INPUT} />
            </FL>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Logo URL">
                <input type="url" value={form.logo_url}
                  onChange={(e) => field("logo_url", e.target.value)}
                  placeholder="https://example.com/logo.png"
                  disabled={saving} className={CLS_INPUT} />
              </FL>
              <FL label="Signature URL">
                <input type="url" value={form.signature_url}
                  onChange={(e) => field("signature_url", e.target.value)}
                  placeholder="https://example.com/signature.png"
                  disabled={saving} className={CLS_INPUT} />
              </FL>
            </div>

            {/* ── Status ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status</p>

            <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <ToggleRow
                label="Active"
                sub="Template is available for use"
                on={form.active}
                onChange={() => field("active", !form.active)}
                disabled={saving}
              />
              <ToggleRow
                label="Default Template"
                sub="Used when no specific template is assigned"
                on={form.default_template}
                onChange={() => field("default_template", !form.default_template)}
                disabled={saving}
              />
              {errs.default_template && (
                <p className="text-xs text-red-500">{errs.default_template}</p>
              )}
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
              {saving ? "Saving…" : isEdit ? "Update Template" : "Add Template"}
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
  | { type: "edit"; template: CertificateTemplate }
  | { type: "delete"; template: CertificateTemplate }
  | null;

export default function CertificateTemplateManagement() {

  const [templates,    setTemplates]    = useState<CertificateTemplate[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [togglingActId, setTogglingActId] = useState<string | null>(null);
  const [settingDefId,  setSettingDefId]  = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);
  const [banner, setBanner] = useState("");
  const [modal,  setModal]  = useState<ModalKind>(null);

  const addBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  // ── Derived
  const usedCodes = useMemo(
    () => templates.map((t) => t.template_code.trim().toLowerCase()),
    [templates]
  );

  const hasExistingDefault = useMemo(
    () => templates.some((t) => t.default_template),
    [templates]
  );

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return templates;
    return templates.filter(
      (t) =>
        t.template_name.toLowerCase().includes(kw) ||
        t.template_code.toLowerCase().includes(kw) ||
        (t.description ?? "").toLowerCase().includes(kw)
    );
  }, [templates, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PER_PAGE;
  const pageRows   = filtered.slice(pageStart, pageStart + PER_PAGE);

  useEffect(() => { setPage(1); }, [search]);

  // ── Load
  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      const data = await loadTemplates();
      setTemplates(data);
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
    async (data: CertificateTemplateForm) => {
      setSaving(true);
      try {
        if (modal?.type === "edit") {
          await saveTemplate(modal.template.id, data);
        } else {
          await createTemplate(data);
        }
        await load();
        setBanner("");
        closeModal();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Unable to save template.");
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
      await removeTemplate(modal.template.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to delete template.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle active — optimistic
  async function handleToggleActive(template: CertificateTemplate) {
    setTogglingActId(template.id);
    try {
      await toggleActive(template.id, !template.active);
      setTemplates((prev) =>
        prev.map((t) => t.id === template.id ? { ...t, active: !template.active } : t)
      );
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to update active status.");
      await load();
    } finally {
      setTogglingActId(null);
    }
  }

  // ── Set default
  async function handleSetDefault(template: CertificateTemplate) {
    if (template.default_template) return;
    setSettingDefId(template.id);
    try {
      await setDefaultTemplate(template.id);
      setTemplates((prev) =>
        prev.map((t) => ({ ...t, default_template: t.id === template.id }))
      );
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to set default template.");
      await load();
    } finally {
      setSettingDefId(null);
    }
  }

  // ── Render
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Certificate Templates</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage layout and design templates for certificates.
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
            Add Template
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-4">
        <div className="relative flex-1 min-w-[240px]">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, description…"
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
        {!loading && (
          <p className="text-sm text-slate-400">
            {filtered.length} {filtered.length === 1 ? "template" : "templates"}{search && " found"}
          </p>
        )}
      </div>

      {/* Error banner */}
      {banner && (
        <div className="mx-6 mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
      <div className="px-6 pb-4">
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
                    { h: "Template",    cls: "text-left"      },
                    { h: "Code",        cls: "text-left"      },
                    { h: "Orientation", cls: "text-center"    },
                    { h: "Paper",       cls: "text-center"    },
                    { h: "Font",        cls: "text-left"      },
                    { h: "Default",     cls: "text-center"    },
                    { h: "Active",      cls: "text-center"    },
                    { h: "Actions",     cls: "text-right"     },
                  ].map(({ h, cls }) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.map((tmpl, i) => {
                  const busyAct = togglingActId === tmpl.id;
                  const busyDef = settingDefId  === tmpl.id;
                  const busy    = busyAct || busyDef;
                  return (
                    <tr key={tmpl.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">{pageStart + i + 1}</td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{tmpl.template_name}</p>
                        {tmpl.description && (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                            {tmpl.description}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                        {tmpl.template_code}
                      </td>

                      <td className="px-4 py-3 text-center text-slate-600">
                        {tmpl.orientation.charAt(0).toUpperCase() + tmpl.orientation.slice(1)}
                      </td>

                      <td className="px-4 py-3 text-center text-slate-600">
                        {tmpl.paper_size}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {tmpl.font_family}, {tmpl.font_size}pt
                      </td>

                      <td className="px-4 py-3 text-center">
                        {tmpl.default_template ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-semibold text-yellow-700 ring-1 ring-yellow-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                            Default
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSetDefault(tmpl)}
                            disabled={busy}
                            aria-label="Set as default"
                            className="rounded-lg px-2.5 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-slate-200 transition hover:bg-yellow-50 hover:text-yellow-700 hover:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busyDef ? "Setting…" : "Set Default"}
                          </button>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(tmpl)}
                          disabled={busy}
                          aria-label="Toggle active"
                          className="disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            tmpl.active
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${tmpl.active ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {tmpl.active ? "Active" : "Inactive"}
                          </span>
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal({ type: "edit", template: tmpl })}
                            disabled={busy}
                            aria-label="Edit template"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openModal({ type: "delete", template: tmpl })}
                            disabled={busy}
                            aria-label="Delete template"
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
        <TemplateModal
          editing={modal.type === "edit" ? modal.template : null}
          usedCodes={usedCodes}
          hasExistingDefault={hasExistingDefault}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {modal?.type === "delete" && (
        <DeleteDialog
          name={modal.template.template_name}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
  );
}
