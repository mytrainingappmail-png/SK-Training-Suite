import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadThemes,
  createTheme,
  saveTheme,
  removeTheme,
  toggleActive,
} from "../../services/theme/themeService";

import type { Theme, ThemeForm } from "../../types/theme";
import { defaultThemeForm, FONT_FAMILIES } from "../../types/theme";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Theme Preview Card
// ─────────────────────────────────────────────────────────────────────────────

function ThemePreview({
  primary,
  secondary,
  sidebar,
  header,
  fontFamily,
  darkMode,
}: {
  primary: string;
  secondary: string;
  sidebar: string;
  header: string;
  fontFamily: string;
  darkMode: boolean;
}) {
  const ff = fontFamily === "System Default" ? "system-ui, sans-serif" : `'${fontFamily}', sans-serif`;

  return (
    <div
      className={`overflow-hidden rounded-xl border text-xs shadow-sm ${darkMode ? "border-slate-700" : "border-slate-200"}`}
      style={{ fontFamily: ff }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ backgroundColor: header, borderBottom: `1px solid ${darkMode ? "#334155" : "#e2e8f0"}` }}
      >
        <span className="font-semibold" style={{ color: darkMode ? "#f8fafc" : "#0f172a" }}>SK Training Suite</span>
        <div className="h-5 w-5 rounded-full" style={{ backgroundColor: primary }} />
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="flex w-20 flex-col gap-1 p-2" style={{ backgroundColor: sidebar }}>
          {["Dashboard", "Courses", "Reports"].map((item) => (
            <div
              key={item}
              className="rounded px-1.5 py-1 text-xs"
              style={{ color: "#cbd5e1" }}
            >
              {item}
            </div>
          ))}
        </div>

        {/* Content area */}
        <div
          className="flex flex-1 flex-col gap-2 p-3"
          style={{ backgroundColor: darkMode ? "#1e293b" : "#f8fafc" }}
        >
          <p className="text-xs font-semibold" style={{ color: darkMode ? "#f1f5f9" : "#0f172a" }}>
            Sample Content
          </p>
          <p className="text-xs" style={{ color: darkMode ? "#94a3b8" : "#64748b" }}>
            This is how body text appears in this theme.
          </p>
          <div className="flex gap-2">
            <button
              className="rounded px-2.5 py-1 text-xs font-semibold"
              style={{ backgroundColor: primary, color: "#fff" }}
            >
              Primary
            </button>
            <button
              className="rounded px-2.5 py-1 text-xs font-semibold"
              style={{ backgroundColor: secondary, color: "#0f172a" }}
            >
              Secondary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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

function ColorField({
  label,
  required,
  value,
  onChange,
  error,
  disabled,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <FL label={label} required={required} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          maxLength={9}
          disabled={disabled}
          className={CLS_INPUT}
        />
      </div>
    </FL>
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
      {Array.from({ length: 4 }).map((_, i) => (
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No themes found" : "No themes yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search ? `No results for "${search}".` : "Create your first theme to get started."}
      </p>
      {!search && (
        <button onClick={onAdd} className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95">
          Add Theme
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
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !busy) onCancel(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="del-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!busy ? onCancel : undefined} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h3 id="del-title" className="mb-1 text-lg font-semibold text-slate-800">Delete Theme</h3>
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
// Theme form modal
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  theme_name?: string;
  primary_color?: string;
  sidebar_color?: string;
  header_color?: string;
  font_family?: string;
}

function ThemeModal({
  editing,
  usedNames,
  saving,
  onSave,
  onClose,
}: {
  editing: Theme | null;
  usedNames: string[];
  saving: boolean;
  onSave: (data: ThemeForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<ThemeForm>(() =>
    isEdit
      ? {
          theme_name:      editing.theme_name,
          primary_color:   editing.primary_color,
          secondary_color: editing.secondary_color,
          sidebar_color:   editing.sidebar_color,
          header_color:    editing.header_color,
          logo_url:        editing.logo_url,
          favicon_url:     editing.favicon_url,
          font_family:     editing.font_family,
          dark_mode:       editing.dark_mode,
          active:          editing.active,
        }
      : { ...defaultThemeForm }
  );

  const [errs, setErrs] = useState<FormErrs>({});
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !saving) onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  function field<K extends keyof ThemeForm>(key: K, val: ThemeForm[K]) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.theme_name.trim()) {
      e.theme_name = "Theme Name is required.";
    } else {
      const name = form.theme_name.trim().toLowerCase();
      const dup = usedNames.includes(name) &&
        (!isEdit || name !== editing.theme_name.trim().toLowerCase());
      if (dup) e.theme_name = "Theme Name already exists.";
    }

    if (!form.primary_color.trim()) e.primary_color = "Primary Color is required.";
    if (!form.sidebar_color.trim()) e.sidebar_color  = "Sidebar Color is required.";
    if (!form.header_color.trim())  e.header_color   = "Header Color is required.";
    if (!form.font_family.trim())   e.font_family    = "Font Family is required.";

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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10" role="dialog" aria-modal="true" aria-labelledby="th-form-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-white shadow-2xl">

        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="th-form-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Theme" : "Add Theme"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update theme settings." : "Create a new application theme."}
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
          <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">

            {/* ── Left column: settings ── */}
            <div className="space-y-5">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Identity</p>

              <FL label="Theme Name" required error={errs.theme_name}>
                <input ref={firstRef} type="text" value={form.theme_name}
                  onChange={(e) => field("theme_name", e.target.value)}
                  placeholder="e.g. Corporate Dark"
                  maxLength={100} disabled={saving} className={CLS_INPUT} />
              </FL>

              <FL label="Font Family" required error={errs.font_family}>
                <select value={form.font_family}
                  onChange={(e) => field("font_family", e.target.value)}
                  disabled={saving} className={CLS_SELECT}>
                  {FONT_FAMILIES.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </FL>

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Colors</p>

              <ColorField label="Primary Color" required
                value={form.primary_color}
                onChange={(v) => field("primary_color", v)}
                error={errs.primary_color} disabled={saving} />

              <ColorField label="Secondary Color"
                value={form.secondary_color}
                onChange={(v) => field("secondary_color", v)}
                disabled={saving} />

              <ColorField label="Sidebar Color" required
                value={form.sidebar_color}
                onChange={(v) => field("sidebar_color", v)}
                error={errs.sidebar_color} disabled={saving} />

              <ColorField label="Header Color" required
                value={form.header_color}
                onChange={(v) => field("header_color", v)}
                error={errs.header_color} disabled={saving} />

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assets</p>

              <FL label="Logo URL">
                <input type="url" value={form.logo_url}
                  onChange={(e) => field("logo_url", e.target.value)}
                  placeholder="https://example.com/logo.png"
                  disabled={saving} className={CLS_INPUT} />
              </FL>

              <FL label="Favicon URL">
                <input type="url" value={form.favicon_url}
                  onChange={(e) => field("favicon_url", e.target.value)}
                  placeholder="https://example.com/favicon.ico"
                  disabled={saving} className={CLS_INPUT} />
              </FL>

              <div className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <ToggleRow
                  label="Dark Mode"
                  sub="Enable dark mode for this theme"
                  on={form.dark_mode}
                  onChange={() => field("dark_mode", !form.dark_mode)}
                  disabled={saving}
                />
                <ToggleRow
                  label="Active"
                  sub="Theme is available for use"
                  on={form.active}
                  onChange={() => field("active", !form.active)}
                  disabled={saving}
                />
              </div>

            </div>

            {/* ── Right column: live preview ── */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Live Preview</p>
              <ThemePreview
                primary={form.primary_color || "#0F172A"}
                secondary={form.secondary_color || "#D4AF37"}
                sidebar={form.sidebar_color || "#1E293B"}
                header={form.header_color || "#FFFFFF"}
                fontFamily={form.font_family}
                darkMode={form.dark_mode}
              />
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
                <p className="font-medium text-slate-700">Color Summary</p>
                {[
                  { label: "Primary",   color: form.primary_color   },
                  { label: "Secondary", color: form.secondary_color },
                  { label: "Sidebar",   color: form.sidebar_color   },
                  { label: "Header",    color: form.header_color    },
                ].map(({ label, color }) => (
                  <div key={label} className="mt-2 flex items-center justify-between">
                    <span>{label}</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded border border-slate-200"
                        style={{ backgroundColor: color || "transparent" }}
                      />
                      <span className="font-mono">{color || "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:opacity-50 active:scale-95">
              {saving ? "Saving…" : isEdit ? "Update Theme" : "Add Theme"}
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
  | { type: "edit";   theme: Theme }
  | { type: "delete"; theme: Theme }
  | null;

export default function ThemeManagement() {

  const [themes,     setThemes]     = useState<Theme[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);
  const [banner, setBanner] = useState("");
  const [modal,  setModal]  = useState<ModalKind>(null);

  const addBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  // ── Derived
  const usedNames = useMemo(
    () => themes.map((t) => t.theme_name.trim().toLowerCase()),
    [themes]
  );

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return themes;
    return themes.filter(
      (t) =>
        t.theme_name.toLowerCase().includes(kw) ||
        t.font_family.toLowerCase().includes(kw) ||
        t.primary_color.toLowerCase().includes(kw)
    );
  }, [themes, search]);

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
      setThemes(await loadThemes());
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
    async (data: ThemeForm) => {
      setSaving(true);
      try {
        if (modal?.type === "edit") {
          await saveTheme(modal.theme.id, data);
        } else {
          await createTheme(data);
        }
        await load();
        setBanner("");
        closeModal();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Unable to save theme.");
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
      await removeTheme(modal.theme.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to delete theme.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle active — optimistic
  async function handleToggleActive(theme: Theme) {
    setTogglingId(theme.id);
    try {
      await toggleActive(theme.id, !theme.active);
      setThemes((prev) =>
        prev.map((t) => t.id === theme.id ? { ...t, active: !theme.active } : t)
      );
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to update status.");
      await load();
    } finally {
      setTogglingId(null);
    }
  }

  // ── Render
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Theme Management</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Create and manage visual themes for the platform.
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
            Add Theme
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-6 py-4">
        <div className="relative min-w-[220px] flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, font, color…"
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
            {filtered.length} {filtered.length === 1 ? "theme" : "themes"}
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
                    { h: "#",          cls: "w-10 text-left" },
                    { h: "Theme",      cls: "text-left"      },
                    { h: "Colors",     cls: "text-left"      },
                    { h: "Font",       cls: "text-left"      },
                    { h: "Dark Mode",  cls: "text-center"    },
                    { h: "Active",     cls: "text-center"    },
                    { h: "Actions",    cls: "text-right"     },
                  ].map(({ h, cls }) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.map((theme, i) => {
                  const busy = togglingId === theme.id;
                  return (
                    <tr key={theme.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">{pageStart + i + 1}</td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{theme.theme_name}</p>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {[theme.primary_color, theme.secondary_color, theme.sidebar_color, theme.header_color].map((c, ci) => (
                            <div
                              key={ci}
                              title={c}
                              className="h-5 w-5 rounded-full border border-slate-200 shadow-sm"
                              style={{ backgroundColor: c || "transparent" }}
                            />
                          ))}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-600">{theme.font_family}</td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          theme.dark_mode
                            ? "bg-slate-800 text-slate-100 ring-1 ring-slate-700"
                            : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                        }`}>
                          {theme.dark_mode ? "Dark" : "Light"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(theme)}
                          disabled={busy}
                          aria-label="Toggle active"
                          className="disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            theme.active
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${theme.active ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {theme.active ? "Active" : "Inactive"}
                          </span>
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openModal({ type: "edit", theme })}
                            disabled={busy}
                            aria-label="Edit theme"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openModal({ type: "delete", theme })}
                            disabled={busy}
                            aria-label="Delete theme"
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
        <ThemeModal
          editing={modal.type === "edit" ? modal.theme : null}
          usedNames={usedNames}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {modal?.type === "delete" && (
        <DeleteDialog
          name={modal.theme.theme_name}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
  );
}
