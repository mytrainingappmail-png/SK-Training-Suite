import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadMenus,
  createMenu,
  saveMenu,
  removeMenu,
  toggleActive,
} from "../../services/menu/menuService";

import type { Menu, MenuForm, MenuLevel } from "../../types/menu";
import { defaultMenuForm, MENU_LEVELS } from "../../types/menu";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function levelCls(level: MenuLevel): string {
  const map: Record<MenuLevel, string> = {
    1: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    2: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    3: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  };
  return map[level] ?? "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No menu items found" : "No menu items yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search ? `No results for "${search}".` : "Add your first menu item to get started."}
      </p>
      {!search && (
        <button onClick={onAdd} className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95">
          Add Menu Item
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
        <h3 id="del-title" className="mb-1 text-lg font-semibold text-slate-800">Delete Menu Item</h3>
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
// Menu form modal
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  menu_code?: string;
  menu_name?: string;
  route_path?: string;
  display_order?: string;
  menu_level?: string;
}

function MenuModal({
  editing,
  allMenus,
  usedCodes,
  saving,
  onSave,
  onClose,
}: {
  editing: Menu | null;
  allMenus: Menu[];
  usedCodes: string[];
  saving: boolean;
  onSave: (data: MenuForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<MenuForm>(() =>
    isEdit
      ? {
          menu_code:      editing.menu_code,
          menu_name:      editing.menu_name,
          parent_menu_id: editing.parent_menu_id,
          route_path:     editing.route_path,
          icon:           editing.icon,
          display_order:  editing.display_order,
          menu_level:     editing.menu_level,
          active:         editing.active,
        }
      : { ...defaultMenuForm }
  );

  const [errs, setErrs] = useState<FormErrs>({});
  const firstRef = useRef<HTMLInputElement>(null);

  // Menus eligible as parent — exclude self on edit
  const parentOptions = useMemo(
    () => allMenus.filter((m) => !isEdit || m.id !== editing.id),
    [allMenus, isEdit, editing]
  );

  useEffect(() => { firstRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !saving) onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  function field<K extends keyof MenuForm>(key: K, val: MenuForm[K]) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.menu_code.trim()) {
      e.menu_code = "Menu Code is required.";
    } else {
      const code = form.menu_code.trim().toLowerCase();
      const dup = usedCodes.includes(code) &&
        (!isEdit || code !== editing.menu_code.trim().toLowerCase());
      if (dup) e.menu_code = "Menu Code already exists.";
    }

    if (!form.menu_name.trim())  e.menu_name  = "Menu Name is required.";
    if (!form.route_path.trim()) e.route_path = "Route Path is required.";

    if (form.display_order < 0) {
      e.display_order = "Display Order must be zero or greater.";
    }
    if (form.menu_level < 1) {
      e.menu_level = "Menu Level must be greater than zero.";
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10" role="dialog" aria-modal="true" aria-labelledby="menu-form-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white shadow-2xl">

        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="menu-form-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Menu Item" : "Add Menu Item"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update menu item details." : "Create a new navigation menu item."}
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
              <FL label="Menu Code" required error={errs.menu_code}>
                <input ref={firstRef} type="text" value={form.menu_code}
                  onChange={(e) => field("menu_code", e.target.value)}
                  placeholder="e.g. MENU-DASHBOARD"
                  maxLength={50} disabled={saving} className={CLS_INPUT} />
              </FL>
              <FL label="Menu Name" required error={errs.menu_name}>
                <input type="text" value={form.menu_name}
                  onChange={(e) => field("menu_name", e.target.value)}
                  placeholder="e.g. Dashboard"
                  maxLength={200} disabled={saving} className={CLS_INPUT} />
              </FL>
            </div>

            {/* ── Navigation ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Navigation</p>

            <FL label="Route Path" required error={errs.route_path}>
              <input type="text" value={form.route_path}
                onChange={(e) => field("route_path", e.target.value)}
                placeholder="e.g. /dashboard"
                maxLength={200} disabled={saving} className={CLS_INPUT} />
            </FL>

            <FL label="Icon Name">
              <input type="text" value={form.icon}
                onChange={(e) => field("icon", e.target.value)}
                placeholder="e.g. layout-dashboard"
                maxLength={100} disabled={saving} className={CLS_INPUT} />
            </FL>

            {/* ── Hierarchy ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Hierarchy</p>

            <FL label="Parent Menu">
              <select
                value={form.parent_menu_id ?? ""}
                onChange={(e) => field("parent_menu_id", e.target.value || null)}
                disabled={saving} className={CLS_SELECT}>
                <option value="">— None (Top-level) —</option>
                {parentOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.menu_name} ({m.menu_code})
                  </option>
                ))}
              </select>
            </FL>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Menu Level" required error={errs.menu_level}>
                <select value={form.menu_level}
                  onChange={(e) => field("menu_level", parseInt(e.target.value, 10) as MenuLevel)}
                  disabled={saving} className={CLS_SELECT}>
                  {MENU_LEVELS.map((ml) => (
                    <option key={ml.value} value={ml.value}>{ml.label}</option>
                  ))}
                </select>
              </FL>

              <FL label="Display Order" error={errs.display_order}>
                <input type="number" min={0} value={form.display_order}
                  onChange={(e) =>
                    field("display_order", Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  disabled={saving} className={CLS_INPUT} />
              </FL>
            </div>

            {/* ── Active ── */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <ToggleRow
                label="Active"
                sub="Menu item is visible in navigation"
                on={form.active}
                onChange={() => field("active", !form.active)}
                disabled={saving}
              />
            </div>

          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:opacity-50 active:scale-95">
              {saving ? "Saving…" : isEdit ? "Update Menu" : "Add Menu"}
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
  | { type: "edit";   menu: Menu }
  | { type: "delete"; menu: Menu }
  | null;

export default function MenuManagement() {

  const [menus,      setMenus]      = useState<Menu[]>([]);

  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [search,      setSearch]      = useState("");
  const [levelFilter, setLevelFilter] = useState<MenuLevel | 0>(0);
  const [page,        setPage]        = useState(1);
  const [banner,      setBanner]      = useState("");
  const [modal,       setModal]       = useState<ModalKind>(null);

  const addBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  // ── Derived
  const usedCodes = useMemo(
    () => menus.map((m) => m.menu_code.trim().toLowerCase()),
    [menus]
  );

  const filtered = useMemo(() => {
    let rows = menus;
    if (levelFilter) rows = rows.filter((m) => m.menu_level === levelFilter);
    const kw = search.trim().toLowerCase();
    if (kw) {
      rows = rows.filter((m) =>
        m.menu_code.toLowerCase().includes(kw) ||
        m.menu_name.toLowerCase().includes(kw) ||
        m.route_path.toLowerCase().includes(kw) ||
        (m.icon ?? "").toLowerCase().includes(kw)
      );
    }
    return rows;
  }, [menus, levelFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PER_PAGE;
  const pageRows   = filtered.slice(pageStart, pageStart + PER_PAGE);

  useEffect(() => { setPage(1); }, [search, levelFilter]);

  // ── Load
  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      setMenus(await loadMenus());
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
    async (data: MenuForm) => {
      setSaving(true);
      try {
        if (modal?.type === "edit") {
          await saveMenu(modal.menu.id, data);
        } else {
          await createMenu(data);
        }
        await load();
        setBanner("");
        closeModal();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Unable to save menu item.");
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
      await removeMenu(modal.menu.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to delete menu item.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle active — optimistic
  async function handleToggleActive(menu: Menu) {
    setTogglingId(menu.id);
    try {
      await toggleActive(menu.id, !menu.active);
      setMenus((prev) =>
        prev.map((m) => m.id === menu.id ? { ...m, active: !menu.active } : m)
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
          <h2 className="text-xl font-bold text-slate-800">Menu Management</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage navigation menu items and their hierarchy.
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
            Add Menu Item
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
            placeholder="Search by code, name, route, icon…"
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

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(parseInt(e.target.value, 10) as MenuLevel | 0)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
        >
          <option value={0}>All Levels</option>
          {MENU_LEVELS.map((ml) => (
            <option key={ml.value} value={ml.value}>{ml.label}</option>
          ))}
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
                    { h: "Menu",        cls: "text-left"      },
                    { h: "Route",       cls: "text-left"      },
                    { h: "Icon",        cls: "text-left"      },
                    { h: "Parent",      cls: "text-left"      },
                    { h: "Level",       cls: "text-center"    },
                    { h: "Order",       cls: "text-center"    },
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
                {pageRows.map((menu, i) => {
                  const busy   = togglingId === menu.id;
                  const parent = menu.parent_menu_id
                    ? menus.find((m) => m.id === menu.parent_menu_id)
                    : null;
                  return (
                    <tr key={menu.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">{pageStart + i + 1}</td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{menu.menu_name}</p>
                        <p className="mt-0.5 font-mono text-xs text-slate-400">{menu.menu_code}</p>
                      </td>

                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {menu.route_path}
                      </td>

                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {menu.icon || "—"}
                      </td>

                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {parent ? parent.menu_name : "—"}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${levelCls(menu.menu_level)}`}>
                          {MENU_LEVELS.find((l) => l.value === menu.menu_level)?.label.split("—")[0].trim() ?? `L${menu.menu_level}`}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center font-medium text-slate-700">
                        {menu.display_order}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(menu)}
                          disabled={busy}
                          aria-label="Toggle active"
                          className="disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            menu.active
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${menu.active ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {menu.active ? "Active" : "Inactive"}
                          </span>
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openModal({ type: "edit", menu })}
                            disabled={busy}
                            aria-label="Edit menu item"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openModal({ type: "delete", menu })}
                            disabled={busy}
                            aria-label="Delete menu item"
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
        <MenuModal
          editing={modal.type === "edit" ? modal.menu : null}
          allMenus={menus}
          usedCodes={usedCodes}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {modal?.type === "delete" && (
        <DeleteDialog
          name={modal.menu.menu_name}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
  );
}
