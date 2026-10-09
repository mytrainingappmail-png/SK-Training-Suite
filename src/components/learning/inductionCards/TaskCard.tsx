// Practice task card: the admin's instructions, then the employee submits text, a link and/or a file —
// whichever the admin switched on. A reviewer can approve it or ask for another try.

import { useRef, useState } from 'react';
import { uploadToCourseContent } from '../../../lib/mediaUpload';
import type { CardProps } from './AcknowledgeCard';
import TranslatableHtml from '../../shared/TranslatableHtml';

const MAX_MB = 25;

interface TaskResponse { text?: string; link?: string; file_url?: string; file_name?: string }

export default function TaskCard({ section, response, onSubmit, showToast, preview }: CardProps & { preview?: boolean }) {
  const cfg = section.config ?? {};
  const allowText = cfg.allow_text !== false;     // text is on unless the admin switched it off
  const allowLink = cfg.allow_link === true;
  const allowFile = cfg.allow_file === true;
  const saved = (response?.response ?? {}) as TaskResponse;

  const [text, setText] = useState(saved.text ?? '');
  const [link, setLink] = useState(saved.link ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const hasText = allowText && text.trim() !== '';
    const hasLink = allowLink && link.trim() !== '';
    const hasFile = allowFile && (!!file || !!saved.file_url);
    if (!hasText && !hasLink && !hasFile) { showToast('Please add your answer first.'); return; }
    if (file && file.size > MAX_MB * 1024 * 1024) { showToast(`That file is bigger than ${MAX_MB} MB — please use a smaller one or paste a link.`); return; }
    setBusy(true);
    try {
      const payload: TaskResponse = { text: text.trim() || undefined, link: link.trim() || undefined, file_url: saved.file_url, file_name: saved.file_name };
      if (file) {
        payload.file_url = preview ? '' : await uploadToCourseContent(file, 'induction-tasks', section.id);
        payload.file_name = file.name;
      }
      await onSubmit(payload as Record<string, unknown>);
      setFile(null);
      setEditing(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not send. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const status = response?.status;
  const locked = status === 'approved';
  const showForm = !response || editing;

  return (
    <div className="space-y-5">
      {section.page_content && (
        <TranslatableHtml className="prose prose-sm max-w-none rounded-xl bg-slate-50 p-5 text-sm leading-relaxed" html={section.page_content} />
      )}

      {response && (
        <div className={`rounded-xl border p-4 text-sm ${status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : status === 'needs_work' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-indigo-100 bg-indigo-50 text-indigo-800'}`}>
          <p className="font-semibold">
            {status === 'approved' ? '✓ Approved' : status === 'needs_work' ? '↻ Please try again' : cfg.must_be_approved ? '⏳ Sent — waiting for review' : '✓ Sent'}
          </p>
          {response.reviewer_comment && <p className="mt-1">“{response.reviewer_comment}”</p>}
        </div>
      )}

      {response && !editing && (
        <div className="space-y-2 rounded-xl border border-slate-100 p-4 text-sm text-slate-700">
          {saved.text && <p className="whitespace-pre-wrap">{saved.text}</p>}
          {saved.link && <p><a href={saved.link} target="_blank" rel="noreferrer" className="break-all font-semibold text-indigo-600 underline">{saved.link}</a></p>}
          {saved.file_name && <p className="text-slate-500">📎 {saved.file_url ? <a href={saved.file_url} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 underline">{saved.file_name}</a> : saved.file_name}</p>}
          {!locked && <button type="button" onClick={() => setEditing(true)} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">{status === 'needs_work' ? 'Send it again' : 'Change my answer'}</button>}
        </div>
      )}

      {showForm && (
        <div className="space-y-3 rounded-xl border-2 border-dashed border-indigo-200 bg-white p-4">
          {allowText && (
            <textarea
              value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={4000} placeholder="Type your answer…"
              className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          )}
          {allowLink && (
            <input
              value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a link (Google Drive, YouTube, …)"
              className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          )}
          {allowFile && (
            <div className="flex flex-wrap items-center gap-3">
              <input ref={fileRef} type="file" accept="audio/*,video/*,image/*,.pdf,.doc,.docx" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                {file ? 'Choose another file' : saved.file_name ? 'Replace the file' : '📎 Add a file'}
              </button>
              <span className="text-xs text-slate-400">{file ? file.name : saved.file_name ?? `Up to ${MAX_MB} MB — a link is easier for big videos.`}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={submit} disabled={busy} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
              {busy ? 'Sending…' : cfg.submit_label?.trim() || 'Submit'}
            </button>
            {response && <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>}
          </div>
        </div>
      )}
    </div>
  );
}
