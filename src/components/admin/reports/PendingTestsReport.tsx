// Reports -> Pending tests: every test an employee still has to pass (assigned assessments and Induction day tests),
// who has not started, who is part-way, who failed and still has attempts, who has run out of attempts, and what is
// overdue. Tick people and send them a reminder that appears in their notification bell; the words are the admin's own.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadPendingTestsData } from '../../../repositories/pendingTests/pendingTestsRepository';
import { buildPendingRows } from '../../../services/pendingTests/pendingTestsService';
import type { PendingRow, PendingStatus } from '../../../services/pendingTests/pendingTestsService';
import { sendTestReminders } from '../../../services/notification/notificationService';
import { getCurrentUser } from '../../../services/auth/session';
import { csvEscape, downloadCsvFile } from '../../../services/quiz/quizCsvService';

type Filter = 'all' | PendingStatus | 'overdue';

const STATUS_META: Record<PendingStatus, { label: string; cls: string }> = {
  not_started: { label: 'Not started', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  in_progress: { label: 'In progress', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  failed: { label: 'Failed - can retry', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  no_attempts_left: { label: 'Failed - no attempts left', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

// The reminder wording is the admin's: what was last used is remembered in this browser, and this first suggestion is
// only a starting point that can be changed before sending.
const REMINDER_KEY = 'pendingTestReminder.v1';
const SUGGESTED = { title: 'Test pending', message: 'Your test "{test}" is still pending. Please open it and complete it as soon as you can.' };

function loadReminder(): { title: string; message: string } {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    if (raw) { const p = JSON.parse(raw); if (typeof p.title === 'string' && typeof p.message === 'string') return p; }
  } catch { /* use the suggestion */ }
  return SUGGESTED;
}

function ago(iso: string | null): string {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}

export default function PendingTestsReport() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [source, setSource] = useState<'all' | 'assessment' | 'induction'>('all');
  const [testFilter, setTestFilter] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState<PendingRow[] | null>(null);
  const [title, setTitle] = useState(SUGGESTED.title);
  const [message, setMessage] = useState(SUGGESTED.message);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setRows(buildPendingRows(await loadPendingTestsData())); setPicked(new Set()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load the pending tests.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const c = { not_started: 0, in_progress: 0, failed: 0, no_attempts_left: 0, overdue: 0 };
    for (const r of rows) { c[r.status] += 1; if (r.overdue) c.overdue += 1; }
    return c;
  }, [rows]);

  const tests = useMemo(() => Array.from(new Set(rows.map((r) => r.testTitle))).sort(), [rows]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (filter === 'all' || (filter === 'overdue' ? r.overdue : r.status === filter)) &&
      (source === 'all' || r.source === source) &&
      (!testFilter || r.testTitle === testFilter) &&
      (!q || `${r.name} ${r.code} ${r.branch} ${r.testTitle}`.toLowerCase().includes(q)));
  }, [rows, filter, source, testFilter, search]);

  const allShownPicked = shown.length > 0 && shown.every((r) => picked.has(r.key));
  const togglePick = (key: string) => setPicked((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const toggleAll = () => setPicked(allShownPicked ? new Set() : new Set(shown.map((r) => r.key)));

  function openCompose(list: PendingRow[]) {
    const saved = loadReminder();
    setTitle(saved.title);
    setMessage(saved.message);
    setNotice('');
    setComposing(list);
  }

  async function send() {
    const user = getCurrentUser();
    if (!composing || !user) { setError('Please log in again to send reminders.'); return; }
    if (!title.trim() || !message.trim()) { setError('Write a title and a message first.'); return; }
    setSending(true);
    setError('');
    try {
      const byTest = new Map<string, string[]>();
      for (const r of composing) byTest.set(r.testTitle, [...(byTest.get(r.testTitle) ?? []), r.employeeId]);
      const people = await sendTestReminders(user.companyId, user.id, `${user.firstName} ${user.lastName}`.trim(), title, message, [...byTest].map(([testTitle, employeeIds]) => ({ testTitle, employeeIds })));
      try { localStorage.setItem(REMINDER_KEY, JSON.stringify({ title, message })); } catch { /* not saved, fine */ }
      setComposing(null);
      setPicked(new Set());
      setNotice(`Reminder sent to ${people} ${people === 1 ? 'person' : 'people'}. They will see it in their notification bell.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the reminder.');
    } finally {
      setSending(false);
    }
  }

  function exportCsv() {
    const head = ['Employee', 'Code', 'Branch', 'Test', 'Where', 'Status', 'Attempts used', 'Attempts allowed', 'Best %', 'Pass %', 'Due date', 'Overdue', 'Mandatory', 'Last attempt'];
    const lines = shown.map((r) => [r.name, r.code, r.branch, r.testTitle, r.where, STATUS_META[r.status].label, String(r.attempts), String(r.maxAttempts), r.bestPct === null ? '' : String(Math.round(r.bestPct)), String(r.passPct), r.dueDate ?? '', r.overdue ? 'Yes' : 'No', r.mandatory === null ? '' : r.mandatory ? 'Yes' : 'No', r.lastAttemptAt ?? '']);
    downloadCsvFile(`pending-tests-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...lines].map((l) => l.map(csvEscape).join(',')).join('\r\n'));
  }

  const TILES: [Filter, string, number][] = [
    ['not_started', 'Not started', counts.not_started],
    ['in_progress', 'In progress', counts.in_progress],
    ['failed', 'Failed - can retry', counts.failed],
    ['no_attempts_left', 'No attempts left', counts.no_attempts_left],
    ['overdue', 'Overdue', counts.overdue],
  ];

  return (
    <div className="space-y-5 p-6">
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TILES.map(([k, label, n]) => (
          <button key={k} type="button" onClick={() => setFilter(filter === k ? 'all' : k)}
            className={`rounded-2xl border p-4 text-left shadow-sm transition ${filter === k ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-1 text-3xl font-bold ${k === 'overdue' && n > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{n}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee, code, branch or test…"
          className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-yellow-400 focus:bg-white" />
        <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
          <option value="all">All places</option><option value="induction">Induction tests</option><option value="assessment">Assigned assessments</option>
        </select>
        <select value={testFilter} onChange={(e) => setTestFilter(e.target.value)} className="max-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
          <option value="">All tests</option>{tests.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="button" onClick={() => void load()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Refresh</button>
        <button type="button" onClick={exportCsv} disabled={shown.length === 0} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Export CSV</button>
        <button type="button" onClick={() => openCompose(rows.filter((r) => picked.has(r.key)))} disabled={picked.size === 0}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">
          🔔 Remind {picked.size > 0 ? `${picked.size} selected` : 'selected'}
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">{rows.length === 0 ? 'Nothing is pending - everyone has passed the tests they were given.' : 'No one matches this filter.'}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-4 py-3"><input type="checkbox" checked={allShownPicked} onChange={toggleAll} aria-label="Select all shown" /></th>
                <th className="px-4 py-3">Employee</th><th className="px-4 py-3">Test</th><th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Best / pass</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Last attempt</th><th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((r) => (
                <tr key={r.key} className={picked.has(r.key) ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3"><input type="checkbox" checked={picked.has(r.key)} onChange={() => togglePick(r.key)} aria-label={`Select ${r.name}`} /></td>
                  <td className="px-4 py-3"><p className="font-semibold text-slate-800">{r.name}</p><p className="text-xs text-slate-400">{r.code}{r.branch ? ` · ${r.branch}` : ''}</p></td>
                  <td className="px-4 py-3"><p className="text-slate-800">{r.testTitle}</p><p className="text-xs text-slate-400">{r.where}{r.mandatory ? ' · mandatory' : ''}</p></td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_META[r.status].cls}`}>{STATUS_META[r.status].label}</span></td>
                  <td className="px-4 py-3 text-slate-700">{r.attempts} of {r.maxAttempts}</td>
                  <td className="px-4 py-3 text-slate-700">{r.bestPct === null ? '—' : `${Math.round(r.bestPct)}%`} / {r.passPct}%</td>
                  <td className="px-4 py-3">{r.dueDate ? <span className={r.overdue ? 'font-semibold text-rose-600' : 'text-slate-600'}>{r.dueDate}{r.overdue ? ' · overdue' : ''}</span> : <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3 text-slate-600">{ago(r.lastAttemptAt)}</td>
                  <td className="px-4 py-3 text-right"><button type="button" onClick={() => openCompose([r])} className="text-xs font-semibold text-indigo-600 hover:underline">Remind</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {composing && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-bold text-slate-900">🔔 Send a reminder</h3>
              <p className="text-xs text-slate-500">To {composing.length} {composing.length === 1 ? 'person' : 'people'} ({new Set(composing.map((r) => r.employeeId)).size} different). It shows in their notification bell.</p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <label className="block text-xs font-semibold text-slate-600">Title
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">Message <span className="font-normal text-slate-400">- write {'{test}'} where the test's name should come</span>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal" />
              </label>
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Example: {message.split('{test}').join(composing[0].testTitle)}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
              <button type="button" onClick={() => setComposing(null)} disabled={sending} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white">Cancel</button>
              <button type="button" onClick={() => void send()} disabled={sending || !title.trim() || !message.trim()} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{sending ? 'Sending…' : 'Send reminder'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
