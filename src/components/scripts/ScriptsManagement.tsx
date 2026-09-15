// src/components/scripts/ScriptsManagement.tsx
//
// Scripts — a standalone, employee-facing section (own sidebar item, own
// search bar) for editable, Word-style sales scripts. Any logged-in
// employee can search, read, and download a script as a PDF; only
// Admin/Super Admin get the Add/Edit/Delete controls — one component,
// role-branched internally (the "Performance Tracker" shape), not a
// separate admin-console screen, since every employee needs this page.
//
// The optional brand watermark toggle lives right in the RichTextEditor's
// own toolbar (via its new toolbarExtra slot) and only ever renders for
// the platform operator's own account — a client's scripts never show it.

import { useEffect, useRef, useState } from 'react';
import { useAuthorization } from '../../hooks/useAuthorization';
import { getCurrentUser } from '../../services/auth/session';
import { loadRoles } from '../../services/role/roleService';
import { loadCompany } from '../../services/company/companyService';
import { scriptService } from '../../services/script/scriptService';
import { exportElementAsPdf } from '../../utils/scriptPdfExport';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import RichTextEditor from '../shared/RichTextEditor';
import SectionHeroBanner from '../learning/SectionHeroBanner';
import BrandWatermarkOverlay from '../shared/BrandWatermarkOverlay';
import type { Script, ScriptForm } from '../../types/script';

function IconSearch({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>);
}
function IconFile({ className = 'h-6 w-6' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>);
}
function IconEdit({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>);
}
function IconTrash({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397M4.772 5.79c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>);
}
function IconDownload({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>);
}
function IconArrowLeft({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>);
}
function IconWatermark({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>);
}

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
}

// ── Rendered as toolbarExtra inside RichTextEditor — only ever mounted
// for the platform operator (the parent gates it), so no extra check here.
function WatermarkToolbarControl({
  enabled, text, onToggle, onTextChange,
}: { enabled: boolean; text: string; onToggle: () => void; onTextChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { onToggle(); setOpen(true); }}
        title="Brand watermark (only visible on your own account)"
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
          enabled ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <IconWatermark />
        Watermark
      </button>
      {enabled && open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-60 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Watermark text</label>
          <input
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="e.g. your brand name"
            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
          />
          <button type="button" onClick={() => setOpen(false)} className="mt-2 w-full rounded-lg bg-slate-800 py-1.5 text-xs font-semibold text-white">Done</button>
        </div>
      )}
    </div>
  );
}

// ── Add / Edit modal ─────────────────────────────────────────────────────

function ScriptFormModal({
  companyId, script, isPlatformOperator, defaultWatermarkText, onClose, onSaved,
}: {
  companyId: string;
  script: Script | null;
  isPlatformOperator: boolean;
  defaultWatermarkText: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(script?.title ?? '');
  const [content, setContent] = useState(script?.content ?? '');
  const [watermarkEnabled, setWatermarkEnabled] = useState(script?.watermark_enabled ?? false);
  const [watermarkText, setWatermarkText] = useState(script?.watermark_text ?? defaultWatermarkText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const form: Partial<ScriptForm> = {
        company_id: companyId,
        title: title.trim(),
        content,
        watermark_enabled: isPlatformOperator ? watermarkEnabled : false,
        watermark_text: isPlatformOperator && watermarkEnabled ? watermarkText.trim() || null : null,
        active: true,
      };
      if (script) await scriptService.update(script.id, form);
      else await scriptService.create(form);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save the script.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">{script ? 'Edit Script' : 'New Script'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Tulip Monsella — Sector 53, Gurgaon"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Script</label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              onImageUpload={(file) => scriptService.uploadInlineImage(file)}
              minHeight={320}
              resetKey={script?.id ?? 'new'}
              toolbarExtra={isPlatformOperator ? (
                <WatermarkToolbarControl
                  enabled={watermarkEnabled}
                  text={watermarkText}
                  onToggle={() => setWatermarkEnabled((v) => !v)}
                  onTextChange={setWatermarkText}
                />
              ) : undefined}
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Script'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reader ────────────────────────────────────────────────────────────────

function ScriptReader({ script, onClose }: { script: Script; onClose: () => void }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!contentRef.current) return;
    setDownloading(true);
    try {
      const filename = `${script.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'script'}.pdf`;
      await exportElementAsPdf(contentRef.current, filename);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
            <IconArrowLeft /> Back
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <IconDownload /> {downloading ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6">
          <div ref={contentRef} className="relative rounded-xl bg-white p-6">
            {script.watermark_enabled && <BrandWatermarkOverlay text={script.watermark_text || ''} />}
            <h1 className="relative mb-4 text-2xl font-bold text-slate-800">{script.title}</h1>
            <div
              className="rte-content relative prose max-w-none text-sm text-slate-700"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(script.content) }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

function ScriptsManagement() {
  const { user } = useAuthorization();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [isPlatformOperator, setIsPlatformOperator] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [modal, setModal] = useState<{ type: 'add' } | { type: 'edit'; script: Script } | null>(null);
  const [reading, setReading] = useState<Script | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    scriptService.getAll().then(setScripts).finally(() => setLoading(false));
  }

  useEffect(load, []);

  useEffect(() => {
    loadCompany().then((c) => {
      setIsPlatformOperator(c?.is_platform_operator ?? false);
      setCompanyName(c?.company_name ?? '');
    }).catch(() => { setIsPlatformOperator(false); setCompanyName(''); });
  }, []);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser?.roleId) return;
    loadRoles()
      .then((roles) => {
        const role = roles.find((r) => r.id === currentUser.roleId);
        setCanManage(role?.role_code === 'SUPER_ADMIN' || role?.role_code === 'ADMIN');
      })
      .catch(() => setCanManage(false));
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this script? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await scriptService.delete(id);
      load();
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = scripts.filter((s) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return s.title.toLowerCase().includes(q) || stripHtml(s.content).toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <SectionHeroBanner
        title="Scripts"
        subtitle="Ready-to-use sales scripts — search, read, and download as a PDF."
        statLabel="Scripts"
        statValue={scripts.length}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search scripts by title or content…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm"
          />
        </div>
        {canManage && (
          <button
            onClick={() => setModal({ type: 'add' })}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            + Add Script
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <IconFile className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">
            {scripts.length === 0 ? 'No scripts yet.' : `No scripts match "${query}".`}
          </p>
          {canManage && scripts.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">Click "+ Add Script" to write your first one.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((script) => (
            <div
              key={script.id}
              className="flex flex-col rounded-2xl border-2 border-slate-800 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <IconFile />
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button onClick={() => setModal({ type: 'edit', script })} title="Edit" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                      <IconEdit />
                    </button>
                    <button
                      onClick={() => handleDelete(script.id)}
                      disabled={deletingId === script.id}
                      title="Delete"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      <IconTrash />
                    </button>
                  </div>
                )}
              </div>
              <h3 className="mt-3 line-clamp-2 text-base font-semibold text-slate-800">{script.title}</h3>
              <p className="mt-1 line-clamp-3 flex-1 text-xs text-slate-500">{stripHtml(script.content) || 'No content yet.'}</p>
              <button
                onClick={() => setReading(script)}
                className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Read Script
              </button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ScriptFormModal
          companyId={user?.companyId ?? ''}
          script={modal.type === 'edit' ? modal.script : null}
          isPlatformOperator={isPlatformOperator}
          defaultWatermarkText={companyName}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}

      {reading && <ScriptReader script={reading} onClose={() => setReading(null)} />}
    </div>
  );
}

export default ScriptsManagement;
