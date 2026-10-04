// "Responses" of one acknowledgment / feedback / task card: who agreed and when, the feedback results at a glance
// (averages, counts, comments — names hidden when the form is anonymous), or task submissions to approve.

import { useEffect, useMemo, useState } from 'react';
import { getCardResponsesForSections, getEmployeeNames, reviewCardResponse } from '../../../repositories/induction/inductionCardRepository';
import { csvEscape, downloadCsvFile } from '../../../services/quiz/quizCsvService';
import type { FeedbackQuestion, InductionCardResponse, InductionDaySection } from '../../../types/induction';

const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
type Answers = Record<string, string | number | boolean | undefined>;
const answersOf = (r: InductionCardResponse): Answers => ((r.response as { answers?: Answers }).answers) ?? {};

function QuestionSummary({ q, rows, nameOf, anonymous }: { q: FeedbackQuestion; rows: InductionCardResponse[]; nameOf: (r: InductionCardResponse) => string; anonymous: boolean }) {
  const given = rows.map((r) => ({ r, v: answersOf(r)[q.id] })).filter((x) => x.v !== undefined && x.v !== '');
  const nums = given.map((x) => Number(x.v)).filter((n) => Number.isFinite(n));
  const max = q.type === 'stars' ? Math.min(Math.max(q.max ?? 5, 3), 10) : Math.min(Math.max(q.max ?? 10, 2), 10);

  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <p className="text-sm font-semibold text-slate-800">{q.label || '(no wording)'}</p>
      <p className="mb-2 text-xs text-slate-400">{given.length} answer{given.length === 1 ? '' : 's'}</p>

      {(q.type === 'stars' || q.type === 'scale') && (
        given.length === 0 ? null : (
          <>
            <p className="mb-2 text-sm font-bold text-indigo-700">{(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)} <span className="text-xs font-medium text-slate-400">average out of {max}</span></p>
            <div className="space-y-1">
              {Array.from({ length: max }, (_, i) => max - i).map((n) => {
                const c = nums.filter((x) => x === n).length;
                return (
                  <div key={n} className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-6 text-right">{n}{q.type === 'stars' ? '★' : ''}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${(c / nums.length) * 100}%` }} /></div>
                    <span className="w-6">{c}</span>
                  </div>
                );
              })}
            </div>
          </>
        )
      )}

      {q.type === 'yesno' && given.length > 0 && (
        <p className="text-sm text-slate-700">Yes <b>{given.filter((x) => x.v === true).length}</b> · No <b>{given.filter((x) => x.v === false).length}</b></p>
      )}

      {q.type === 'choice' && (
        <div className="space-y-1">
          {(q.options ?? []).filter((o) => o.trim()).map((o) => {
            const c = given.filter((x) => x.v === o).length;
            return (
              <div key={o} className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-32 truncate text-right">{o}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: given.length ? `${(c / given.length) * 100}%` : '0%' }} /></div>
                <span className="w-6">{c}</span>
              </div>
            );
          })}
        </div>
      )}

      {q.type === 'text' && (
        <ul className="space-y-2">
          {given.map(({ r, v }) => (
            <li key={r.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              “{String(v)}”{!anonymous && <span className="ml-2 text-xs text-slate-400">— {nameOf(r)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function InductionResponsesModal({ section, reviewerId, onClose }: { section: InductionDaySection; reviewerId: string; onClose: () => void }) {
  const [rows, setRows] = useState<InductionCardResponse[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    getCardResponsesForSections([section.id])
      .then(async (r) => { setRows(r); setNames(await getEmployeeNames([...new Set(r.map((x) => x.employee_id))])); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the responses.'));
  }
  useEffect(load, [section.id]);

  const cfg = section.config ?? {};
  const anonymous = cfg.anonymous === true;
  const nameOf = (r: InductionCardResponse) => names[r.employee_id] ?? 'Employee';
  const questions = cfg.questions ?? [];
  const list = rows ?? [];

  async function review(r: InductionCardResponse, status: 'approved' | 'needs_work') {
    setBusyId(r.id);
    try { await reviewCardResponse(r.id, status, comments[r.id] ?? r.reviewer_comment ?? '', reviewerId); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save the review.'); }
    finally { setBusyId(null); }
  }

  const csv = useMemo(() => {
    if (section.section_type !== 'feedback') return '';
    const head = ['Employee', 'Date', ...questions.map((q) => q.label)];
    const lines = list.map((r) => [anonymous ? 'Anonymous' : nameOf(r), fmt(r.created_at), ...questions.map((q) => { const v = answersOf(r)[q.id]; return v === undefined ? '' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v); })]);
    return [head, ...lines].map((l) => l.map(csvEscape).join(',')).join('\r\n');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, names]);

  return (
    <div className="fixed inset-0 z-[65] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-0 sm:p-6">
      <div className="relative w-full max-w-3xl rounded-none bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Responses — {section.title}</h3>
            <p className="text-xs text-slate-400">{rows ? `${list.length} response${list.length === 1 ? '' : 's'}` : 'Loading…'}</p>
          </div>
          <div className="flex items-center gap-2">
            {section.section_type === 'feedback' && list.length > 0 && (
              <button type="button" onClick={() => downloadCsvFile(`feedback-${section.title.replace(/\W+/g, '-').toLowerCase()}.csv`, csv)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Download CSV</button>
            )}
            <button type="button" onClick={onClose} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Close</button>
          </div>
        </div>

        {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {rows && list.length === 0 && <p className="py-10 text-center text-sm text-slate-400">Nobody has answered yet.</p>}

        {section.section_type === 'acknowledge' && list.length > 0 && (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {list.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-semibold text-slate-800">{nameOf(r)}</span>
                <span className="text-xs text-emerald-700">✓ Agreed {fmt(r.created_at)}</span>
              </div>
            ))}
          </div>
        )}

        {section.section_type === 'feedback' && list.length > 0 && (
          <div className="space-y-3">
            {questions.map((q) => <QuestionSummary key={q.id} q={q} rows={list} nameOf={nameOf} anonymous={anonymous} />)}
            {anonymous && <p className="text-xs text-slate-400">Names are hidden here because this form is set to anonymous.</p>}
          </div>
        )}

        {section.section_type === 'task' && list.length > 0 && (
          <div className="space-y-3">
            {list.map((r) => {
              const v = r.response as { text?: string; link?: string; file_url?: string; file_name?: string };
              return (
                <div key={r.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{nameOf(r)} <span className="ml-1 text-xs font-normal text-slate-400">{fmt(r.updated_at)}</span></p>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${r.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : r.status === 'needs_work' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>
                      {r.status === 'approved' ? 'Approved' : r.status === 'needs_work' ? 'Needs another try' : 'Waiting for review'}
                    </span>
                  </div>
                  {v.text && <p className="mb-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{v.text}</p>}
                  {v.link && <p className="mb-1 text-sm"><a href={v.link} target="_blank" rel="noreferrer" className="break-all font-semibold text-indigo-600 underline">{v.link}</a></p>}
                  {v.file_name && <p className="mb-2 text-sm text-slate-500">📎 {v.file_url ? <a href={v.file_url} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 underline">{v.file_name}</a> : v.file_name}</p>}
                  <input
                    value={comments[r.id] ?? r.reviewer_comment ?? ''} onChange={(e) => setComments((c) => ({ ...c, [r.id]: e.target.value }))}
                    placeholder="Comment for the employee (optional)" className="mb-2 w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busyId === r.id} onClick={() => review(r, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button>
                    <button type="button" disabled={busyId === r.id} onClick={() => review(r, 'needs_work')} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Ask to try again</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
