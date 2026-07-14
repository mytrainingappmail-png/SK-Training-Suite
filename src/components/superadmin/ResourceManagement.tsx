import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadResources,
  createResource,
  saveResource,
  removeResource,
  toggleResourceStatus,
} from "../../services/resource/resourceService";
import { loadLessons } from "../../services/lesson/lessonService";

import type { Resource, ResourceForm, ResourceType } from "../../types/resource";
import type { Lesson } from "../../types/lesson";
import { defaultResourceForm } from "../../types/resource";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: "video",        label: "Video"        },
  { value: "pdf",          label: "PDF"          },
  { value: "ppt",          label: "PPT"          },
  { value: "word",         label: "Word"         },
  { value: "excel",        label: "Excel"        },
  { value: "image",        label: "Image"        },
  { value: "audio",        label: "Audio"        },
  { value: "zip",          label: "ZIP"          },
  { value: "external_url", label: "External URL" },
  { value: "youtube",      label: "YouTube"      },
  { value: "scorm",        label: "SCORM"        },
  { value: "other",        label: "Other"        },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function findName<T extends { id: string }>(
  list: T[],
  id: string,
  key: keyof T
): string {
  if (!id) return "—";
  const match = list.find((x) => x.id === id);
  return match ? String(match[key]) : "—";
}

function typeLabel(value: ResourceType): string {
  return RESOURCE_TYPES.find((t) => t.value === value)?.label ?? value;
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

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function TypeBadge({ value }: { value: ResourceType }) {
  const colours: Partial<Record<ResourceType, string>> = {
    video:        "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    pdf:          "bg-red-50 text-red-700 ring-1 ring-red-200",
    ppt:          "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    word:         "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    excel:        "bg-green-50 text-green-700 ring-1 ring-green-200",
    image:        "bg-pink-50 text-pink-700 ring-1 ring-pink-200",
    audio:        "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
    zip:          "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
    external_url: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    youtube:      "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    scorm:        "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    other:        "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
  };
  const cls = colours[value] ?? "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {typeLabel(value)}
    </span>
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
// Skeleton
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

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

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
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No resources found" : "No resources yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search
          ? `No results for "${search}". Try a different keyword.`
          : "Add your first learning resource to get started."}
      </p>
      {!search && (
        <button
          onClick={onAdd}
          className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
        >
          Add Resource
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete confirmation dialog
// ─────────────────────────────────────────────────────────────────────────────

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
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h3 id="dd-title" className="mb-1 text-lg font-semibold text-slate-800">
          Delete Resource
        </h3>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-slate-700">{name}</span>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 active:scale-95"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource form modal
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  lesson_id?: string;
  resource_title?: string;
  resource_type?: string;
  file_url?: string;
  display_order?: string;
}

function ResourceModal({
  editing,
  lessons,
  usedOrders,
  saving,
  onSave,
  onClose,
}: {
  editing: Resource | null;
  lessons: Lesson[];
  usedOrders: number[];
  saving: boolean;
  onSave: (data: ResourceForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<ResourceForm>(() =>
    isEdit
      ? {
          lesson_id:      editing.lesson_id,
          resource_title: editing.resource_title,
          resource_type:  editing.resource_type,
          file_url:       editing.file_url,
          description:    editing.description,
          display_order:  editing.display_order,
          downloadable:   editing.downloadable,
          active:         editing.active,
        }
      : { ...defaultResourceForm }
  );

  const [errs, setErrs] = useState<FormErrs>({});
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  function field<K extends keyof ResourceForm>(key: K, val: ResourceForm[K]) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.lesson_id)              e.lesson_id      = "Lesson is required.";
    if (!form.resource_title.trim())  e.resource_title = "Resource Title is required.";
    if (!form.resource_type)          e.resource_type  = "Resource Type is required.";
    if (!form.file_url.trim())        e.file_url       = "File URL is required.";

    if (form.display_order < 1) {
      e.display_order = "Display Order must be at least 1.";
    } else if (
      usedOrders.includes(form.display_order) &&
      (!isEdit || form.display_order !== editing.display_order)
    ) {
      e.display_order = `Display Order ${form.display_order} is already used by another resource in this lesson.`;
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
      aria-labelledby="res-form-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!saving ? onClose : undefined}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="res-form-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Resource" : "Add Resource"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update resource details." : "Fill in the resource details below."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} noValidate>
          <div className="space-y-5 p-6">

            {/* Lesson */}
            <FL label="Lesson" required error={errs.lesson_id}>
              <select
                ref={firstRef}
                value={form.lesson_id}
                onChange={(e) => field("lesson_id", e.target.value)}
                disabled={saving}
                className={CLS_SELECT}
              >
                <option value="">— Select Lesson —</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>{l.lesson_title}</option>
                ))}
              </select>
            </FL>

            {/* Resource Title */}
            <FL label="Resource Title" required error={errs.resource_title}>
              <input
                type="text"
                value={form.resource_title}
                onChange={(e) => field("resource_title", e.target.value)}
                placeholder="e.g. Chapter 1 Slides"
                maxLength={200}
                disabled={saving}
                className={CLS_INPUT}
              />
            </FL>

            {/* Type + Order */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Resource Type" required error={errs.resource_type}>
                <select
                  value={form.resource_type}
                  onChange={(e) => field("resource_type", e.target.value as ResourceType)}
                  disabled={saving}
                  className={CLS_SELECT}
                >
                  <option value="">— Select Type —</option>
                  {RESOURCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </FL>

              <FL label="Display Order" required error={errs.display_order}>
                <input
                  type="number"
                  min={1}
                  value={form.display_order}
                  onChange={(e) =>
                    field("display_order", Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
            </div>

            {/* File URL */}
            <FL label="File URL" required error={errs.file_url}>
              <input
                type="url"
                value={form.file_url}
                onChange={(e) => field("file_url", e.target.value)}
                placeholder="https://example.com/resource.pdf"
                disabled={saving}
                className={CLS_INPUT}
              />
            </FL>

            {/* Description */}
            <FL label="Description">
              <textarea
                value={form.description}
                onChange={(e) => field("description", e.target.value)}
                placeholder="Optional description of this resource"
                rows={3}
                disabled={saving}
                className={CLS_TEXTAREA}
              />
            </FL>

            {/* Downloadable + Active */}
            <div className="flex flex-wrap gap-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <Toggle
                  on={form.downloadable}
                  onChange={() => field("downloadable", !form.downloadable)}
                  disabled={saving}
                />
                <div>
                  <p className="text-sm font-medium text-slate-700">Downloadable</p>
                  <p className="text-xs text-slate-500">Allow learners to download this resource</p>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3">
                <Toggle
                  on={form.active}
                  onChange={() => field("active", !form.active)}
                  disabled={saving}
                />
                <div>
                  <p className="text-sm font-medium text-slate-700">Active</p>
                  <p className="text-xs text-slate-500">Resource is visible to learners</p>
                </div>
              </label>
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:opacity-50 active:scale-95"
            >
              {saving ? "Saving…" : isEdit ? "Update Resource" : "Add Resource"}
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
  | { type: "edit"; resource: Resource }
  | { type: "delete"; resource: Resource }
  | null;

export default function ResourceManagement() {

  const [resources, setResources] = useState<Resource[]>([]);
  const [lessons,   setLessons]   = useState<Lesson[]>([]);

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
  function getUsedOrders(lessonId: string, excludeId?: string): number[] {
    return resources
      .filter((r) => r.lesson_id === lessonId && r.id !== excludeId)
      .map((r) => r.display_order);
  }

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return resources;
    return resources.filter(
      (r) =>
        r.resource_title.toLowerCase().includes(kw) ||
        r.resource_type.toLowerCase().includes(kw) ||
        (r.description ?? "").toLowerCase().includes(kw)
    );
  }, [resources, search]);

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
      const [resourceData, lessonData] = await Promise.all([
        loadResources(),
        loadLessons(),
      ]);
      setResources(resourceData);
      setLessons(lessonData);
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
    async (data: ResourceForm) => {
      setSaving(true);
      try {
        if (modal?.type === "edit") {
          await saveResource(modal.resource.id, data);
        } else {
          await createResource(data);
        }
        await load();
        setBanner("");
        closeModal();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Unable to save resource.");
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
      await removeResource(modal.resource.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to delete resource.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle — optimistic
  async function handleToggle(resource: Resource) {
    setTogglingId(resource.id);
    try {
      await toggleResourceStatus(resource.id, !resource.active);
      setResources((prev) =>
        prev.map((r) => r.id === resource.id ? { ...r, active: !resource.active } : r)
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
          <h2 className="text-xl font-bold text-slate-800">Resource Management</h2>
          <p className="mt-0.5 text-sm text-slate-500">Manage learning resources attached to lessons.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => load()}
            disabled={loading}
            aria-label="Refresh"
            className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Spinner spin={loading} />
          </button>
          <button
            ref={addBtnRef}
            onClick={() => openModal({ type: "add" })}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Resource
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-4">
        <div className="relative flex-1 min-w-[240px]">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, type, description…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-yellow-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {!loading && (
          <p className="text-sm text-slate-400">
            {filtered.length} {filtered.length === 1 ? "resource" : "resources"}{search && " found"}
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
                    { h: "#",               cls: "w-10 text-left" },
                    { h: "Resource Title",  cls: "text-left"      },
                    { h: "Lesson",          cls: "text-left"      },
                    { h: "Type",            cls: "text-left"      },
                    { h: "Order",           cls: "text-center"    },
                    { h: "Download",        cls: "text-center"    },
                    { h: "Status",          cls: "text-center"    },
                    { h: "Actions",         cls: "text-right"     },
                  ].map(({ h, cls }) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${cls}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.map((resource, i) => {
                  const busy = togglingId === resource.id;
                  return (
                    <tr key={resource.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">{pageStart + i + 1}</td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{resource.resource_title}</p>
                        {resource.description && (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                            {resource.description}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {findName(lessons, resource.lesson_id, "lesson_title")}
                      </td>

                      <td className="px-4 py-3">
                        <TypeBadge value={resource.resource_type} />
                      </td>

                      <td className="px-4 py-3 text-center text-slate-600">
                        {resource.display_order}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            resource.downloadable
                              ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                              : "bg-slate-100 text-slate-400 ring-1 ring-slate-200"
                          }`}
                        >
                          {resource.downloadable ? "Yes" : "No"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggle(resource)}
                          disabled={busy}
                          aria-label="Toggle status"
                          className="disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <StatusPill active={resource.active} />
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal({ type: "edit", resource })}
                            disabled={busy}
                            aria-label="Edit resource"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openModal({ type: "delete", resource })}
                            disabled={busy}
                            aria-label="Delete resource"
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
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {(modal?.type === "add" || modal?.type === "edit") && (
        <ResourceModal
          editing={modal.type === "edit" ? modal.resource : null}
          lessons={lessons}
          usedOrders={
            modal.type === "edit"
              ? getUsedOrders(modal.resource.lesson_id, modal.resource.id)
              : []
          }
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {modal?.type === "delete" && (
        <DeleteDialog
          name={modal.resource.resource_title}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
  );
}
