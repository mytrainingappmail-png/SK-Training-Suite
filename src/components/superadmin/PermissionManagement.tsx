import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadPermissions,
  createPermission,
  savePermission,
  removePermission,
} from "../../services/permission/permissionService";

import type { Permission, PermissionForm } from "../../types/permission";
import { defaultPermissionForm, MODULE_NAMES } from "../../types/permission";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function moduleBadgeCls(module: string): string {
  const map: Record<string, string> = {
    "Company":                  "bg-blue-50   text-blue-700   ring-1 ring-blue-200",
    "Branch":                   "bg-cyan-50   text-cyan-700   ring-1 ring-cyan-200",
    "Department":               "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    "Designation":              "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
    "Employee":                 "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    "Category":                 "bg-teal-50   text-teal-700   ring-1 ring-teal-200",
    "Course":                   "bg-amber-50  text-amber-700  ring-1 ring-amber-200",
    "Module":                   "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    "Lesson":                   "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
    "Resource":                 "bg-lime-50   text-lime-700   ring-1 ring-lime-200",
    "Assessment":               "bg-rose-50   text-rose-700   ring-1 ring-rose-200",
    "Question Bank":            "bg-red-50    text-red-700    ring-1 ring-red-200",
    "Assignment":               "bg-pink-50   text-pink-700   ring-1 ring-pink-200",
    "Evaluation Rule":          "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200",
    "Assessment Result":        "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    "Certificate":              "bg-sky-50    text-sky-700    ring-1 ring-sky-200",
    "Certificate Template":     "bg-blue-50   text-blue-700   ring-1 ring-blue-200",
    "Certificate Queue":        "bg-cyan-50   text-cyan-700   ring-1 ring-cyan-200",
    "Certificate Verification": "bg-teal-50   text-teal-700   ring-1 ring-teal-200",
    "Learning Path":            "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    "Learning Path Course":     "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
    "Learning Path Enrollment": "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    "Learning Path Progress":   "bg-green-50  text-green-700  ring-1 ring-green-200",
    "Training Batch":           "bg-amber-50  text-amber-700  ring-1 ring-amber-200",
    "Role":                     "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    "Permission":               "bg-rose-50   text-rose-700   ring-1 ring-rose-200",
    "Menu":                     "bg-slate-100 text-slate-600  ring-1 ring-slate-200",
    "Theme":                    "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
    "Reports":                  "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    "Settings":                 "bg-gray-100  text-gray-600   ring-1 ring-gray-200",
  };
  return map[module] ?? "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No permissions found" : "No permissions yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search ? `No results for "${search}".` : "Add your first permission to get started."}
      </p>
      {!search && (
        <button onClick={onAdd} className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95">
          Add Permission
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
        <h3 id="del-title" className="mb-1 text-lg font-semibold text-slate-800">Delete Permission</h3>
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
// Permission form modal
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  permission_code?: string;
  permission_name?: string;
  module_name?: string;
}

function PermissionModal({
  editing,
  usedCodes,
  saving,
  onSave,
  onClose,
}: {
  editing: Permission | null;
  usedCodes: string[];
  saving: boolean;
  onSave: (data: PermissionForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<PermissionForm>(() =>
    isEdit
      ? {
          permission_code: editing.permission_code,
          permission_name: editing.permission_name,
          module_name:     editing.module_name,
          description:     editing.description,
        }
      : { ...defaultPermissionForm }
  );

  const [errs, setErrs] = useState<FormErrs>({});
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !saving) onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  function field<K extends keyof PermissionForm>(key: K, val: PermissionForm[K]) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.module_name.trim())     e.module_name     = "Module Name is required.";
    if (!form.permission_code.trim()) e.permission_code = "Permission Code is required.";
    if (!form.permission_name.trim()) e.permission_name = "Permission Name is required.";

    if (!e.permission_code) {
      const code = form.permission_code.trim().toLowerCase();
      const dup = usedCodes.includes(code) &&
        (!isEdit || code !== editing.permission_code.trim().toLowerCase());
      if (dup) e.permission_code = "Permission Code already exists.";
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10" role="dialog" aria-modal="true" aria-labelledby="perm-form-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white shadow-2xl">

        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="perm-form-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Permission" : "Add Permission"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update permission details." : "Create a new permission."}
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

            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Identity</p>

            <FL label="Module" required error={errs.module_name}>
              <select ref={firstRef} value={form.module_name}
                onChange={(e) => field("module_name", e.target.value)}
                disabled={saving} className={CLS_SELECT}>
                <option value="">— Select Module —</option>
                {MODULE_NAMES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </FL>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Permission Code" required error={errs.permission_code}>
                <input type="text" value={form.permission_code}
                  onChange={(e) => field("permission_code", e.target.value)}
                  placeholder="e.g. COMPANY_VIEW"
                  maxLength={80} disabled={saving} className={CLS_INPUT} />
              </FL>
              <FL label="Permission Name" required error={errs.permission_name}>
                <input type="text" value={form.permission_name}
                  onChange={(e) => field("permission_name", e.target.value)}
                  placeholder="e.g. View Company"
                  maxLength={200} disabled={saving} className={CLS_INPUT} />
              </FL>
            </div>

            <FL label="Description">
              <textarea value={form.description}
                onChange={(e) => field("description", e.target.value)}
                placeholder="Optional description of this permission"
                rows={3} disabled={saving} className={CLS_TEXTAREA} />
            </FL>

          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:opacity-50 active:scale-95">
              {saving ? "Saving…" : isEdit ? "Update Permission" : "Add Permission"}
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
  | { type: "edit";   permission: Permission }
  | { type: "delete"; permission: Permission }
  | null;

export default function PermissionManagement() {

  const [permissions, setPermissions] = useState<Permission[]>([]);

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search,       setSearch]       = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [page,         setPage]         = useState(1);
  const [banner,       setBanner]       = useState("");
  const [modal,        setModal]        = useState<ModalKind>(null);

  const addBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  // ── Derived
  const usedCodes = useMemo(
    () => permissions.map((p) => p.permission_code.trim().toLowerCase()),
    [permissions]
  );

  const filtered = useMemo(() => {
    let rows = permissions;
    if (moduleFilter) rows = rows.filter((r) => r.module_name === moduleFilter);
    const kw = search.trim().toLowerCase();
    if (kw) {
      rows = rows.filter((r) =>
        r.permission_code.toLowerCase().includes(kw) ||
        r.permission_name.toLowerCase().includes(kw) ||
        r.module_name.toLowerCase().includes(kw) ||
        (r.description ?? "").toLowerCase().includes(kw)
      );
    }
    return rows;
  }, [permissions, moduleFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PER_PAGE;
  const pageRows   = filtered.slice(pageStart, pageStart + PER_PAGE);

  useEffect(() => { setPage(1); }, [search, moduleFilter]);

  // ── Load
  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      setPermissions(await loadPermissions());
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
    async (data: PermissionForm) => {
      setSaving(true);
      try {
        if (modal?.type === "edit") {
          await savePermission(modal.permission.id, data);
        } else {
          await createPermission(data);
        }
        await load();
        setBanner("");
        closeModal();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Unable to save permission.");
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
      await removePermission(modal.permission.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to delete permission.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Render
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Permission Management</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Define and manage system permissions across all modules.
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
            Add Permission
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
            placeholder="Search by code, name, module…"
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

        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30">
          <option value="">All Modules</option>
          {MODULE_NAMES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {!loading && (
          <p className="self-center text-sm text-slate-400">
            {filtered.length} {filtered.length === 1 ? "permission" : "permissions"}
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
                    { h: "Permission",     cls: "text-left"      },
                    { h: "Module",         cls: "text-left"      },
                    { h: "Description",    cls: "text-left"      },
                    { h: "Actions",        cls: "text-right"     },
                  ].map(({ h, cls }) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.map((perm, i) => (
                  <tr key={perm.id} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-400">{pageStart + i + 1}</td>

                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{perm.permission_name}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">{perm.permission_code}</p>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${moduleBadgeCls(perm.module_name)}`}>
                        {perm.module_name}
                      </span>
                    </td>

                    <td className="px-4 py-3 max-w-xs truncate text-slate-500">
                      {perm.description || "—"}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openModal({ type: "edit", permission: perm })}
                          aria-label="Edit permission"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openModal({ type: "delete", permission: perm })}
                          aria-label="Delete permission"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
        <PermissionModal
          editing={modal.type === "edit" ? modal.permission : null}
          usedCodes={usedCodes}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {modal?.type === "delete" && (
        <DeleteDialog
          name={modal.permission.permission_name}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
  );
}
