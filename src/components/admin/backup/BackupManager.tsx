// Admin → Backup & Restore. A full copy of everything the app keeps for the company (courses, induction, projects, tests, quizzes,
// shop, employees, results... and anything a future feature adds), made on demand or automatically every week, downloadable, and
// restorable. Restore is safe by default: it only brings back what is missing and never overwrites or deletes anything.

import { useEffect, useRef, useState } from 'react';
import { getCurrentUser } from '../../../services/auth/session';
import {
  backupDownloadUrl, createBackupNow, deleteBackup, listBackups, loadBackupSettings, restoreBackup, saveBackupSettings,
  startDownload, uploadBackupFile,
} from '../../../services/backup/backupService';
import type { BackupRow, BackupSettings, RestoreResult } from '../../../services/backup/backupService';
import PictureOptimiser from './PictureOptimiser';

const KIND_LABEL: Record<BackupRow['kind'], { label: string; cls: string }> = {
  manual: { label: 'Manual', cls: 'bg-indigo-50 text-indigo-700' },
  weekly: { label: 'Weekly (automatic)', cls: 'bg-emerald-50 text-emerald-700' },
  before_restore: { label: 'Safety copy before a restore', cls: 'bg-amber-50 text-amber-800' },
};

const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const niceTable = (t: string) => t.replace(/_/g, ' ');
const totalRows = (counts: Record<string, number>) => Object.values(counts ?? {}).reduce((a, b) => a + Number(b || 0), 0);

type Target = { id?: string; uploadPath?: string; label: string };

export default function BackupManager() {
  const user = getCurrentUser();
  const companyId = user?.companyId ?? '';
  const [rows, setRows] = useState<BackupRow[]>([]);
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState('');           // what is running right now
  const [savingSettings, setSavingSettings] = useState(false);
  const [target, setTarget] = useState<Target | null>(null); // the backup chosen for a restore
  const [overwrite, setOverwrite] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [outcome, setOutcome] = useState<{ result: RestoreResult; safetyId: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function say(m: string) { setToast(m); setTimeout(() => setToast(''), 3500); }

  async function refresh() {
    try {
      const [list, st] = await Promise.all([listBackups(), loadBackupSettings(companyId)]);
      setRows(list); setSettings(st); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the backups.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (companyId) void refresh(); else setLoading(false); }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function makeNow() {
    setBusy('create'); setError('');
    try {
      const { url } = await createBackupNow();
      startDownload(url);
      say('Backup made and downloading. Keep the file somewhere safe (for example your Google Drive).');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not make the backup.'); }
    finally { setBusy(''); }
  }

  async function download(row: BackupRow) {
    setBusy(`dl:${row.id}`);
    try { startDownload(await backupDownloadUrl(row.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not download.'); }
    finally { setBusy(''); }
  }

  async function remove(row: BackupRow) {
    if (!window.confirm(`Delete the backup of ${fmtDate(row.created_at)}? This cannot be undone.`)) return;
    setBusy(`rm:${row.id}`);
    try { await deleteBackup(row.id); await refresh(); say('Backup deleted.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete.'); }
    finally { setBusy(''); }
  }

  async function saveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    try { await saveBackupSettings(settings); say('Saved.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setSavingSettings(false); }
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setBusy('upload'); setError('');
    try {
      const path = await uploadBackupFile(companyId, file);
      setTarget({ uploadPath: path, label: `the file “${file.name}”` });
      setOverwrite(false); setConfirmText(''); setOutcome(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read that file.'); }
    finally { setBusy(''); if (fileInput.current) fileInput.current.value = ''; }
  }

  async function runRestore() {
    if (!target) return;
    setRestoring(true); setError('');
    try {
      const res = await restoreBackup({ id: target.id, uploadPath: target.uploadPath, overwrite });
      setOutcome({ result: res.result, safetyId: res.safety_backup_id });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'The restore did not finish.'); }
    finally { setRestoring(false); }
  }

  const closeRestore = () => { if (!restoring) { setTarget(null); setOutcome(null); } };
  const restoredRows = outcome ? Object.entries(outcome.result.tables).filter(([, v]) => (v.brought_back ?? 0) + (v.reset_to_backup ?? 0) + (v.failed ?? 0) > 0 || v.skipped) : [];
  const brought = restoredRows.reduce((a, [, v]) => a + (v.brought_back ?? 0) + (v.reset_to_backup ?? 0), 0);

  if (loading) return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-900 p-6 text-white shadow-sm">
        <h2 className="text-xl font-bold">Backup &amp; Restore</h2>
        <p className="mt-1 max-w-2xl text-sm text-white/80">
          A full copy of everything your company has here — courses, induction, projects, tests, quizzes, employees, results — and anything new that is added to the app later is included automatically.
          Pictures, videos and PDFs stay where they are stored; the backup remembers their links.
        </p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-base font-bold text-slate-900">Make a backup now</h3>
          <p className="mt-1 text-sm text-slate-600">Creates a backup and downloads the file to your computer. Takes a short while for a big company.</p>
          <button type="button" onClick={() => void makeNow()} disabled={!!busy} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60">
            {busy === 'create' ? 'Making your backup… please wait' : '⬇ Download a full backup now'}
          </button>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-800">Restore from a file on your computer</p>
            <p className="mt-0.5 text-xs text-slate-500">Choose a backup file you downloaded earlier. Nothing changes until you confirm on the next screen.</p>
            <input ref={fileInput} type="file" accept=".gz,.json,.json.gz,application/gzip,application/json" className="hidden" onChange={(e) => void pickFile(e.target.files?.[0])} />
            <button type="button" onClick={() => fileInput.current?.click()} disabled={!!busy} className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              {busy === 'upload' ? 'Uploading…' : '📂 Choose a backup file…'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-base font-bold text-slate-900">Automatic weekly backup</h3>
          <p className="mt-1 text-sm text-slate-600">Every Monday early morning a backup is made for you, with no one having to remember.</p>
          {settings && (
            <div className="mt-4 space-y-4">
              <label className="flex items-start gap-3 text-sm text-slate-800">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={settings.weekly_enabled} onChange={(e) => setSettings({ ...settings, weekly_enabled: e.target.checked })} />
                <span><b>Make a backup every week</b><br /><span className="text-xs text-slate-500">{settings.last_weekly_at ? `Last automatic backup: ${fmtDate(settings.last_weekly_at)}` : 'No automatic backup has run yet.'}</span></span>
              </label>
              <label className="block text-xs font-semibold text-slate-600">Keep the latest
                <select value={settings.keep_count} onChange={(e) => setSettings({ ...settings, keep_count: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  {[4, 8, 12, 26, 52].map((n) => <option key={n} value={n}>{n} weekly backups</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600">Email me a download link each week (optional)
                <input type="email" value={settings.notify_email ?? ''} onChange={(e) => setSettings({ ...settings, notify_email: e.target.value })} placeholder="you@example.com" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <span className="mt-1 block text-[11px] font-normal text-slate-400">Save the file from the email to your Google Drive for an extra copy outside the app.</span>
              </label>
              <button type="button" onClick={() => void saveSettings()} disabled={savingSettings} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{savingSettings ? 'Saving…' : 'Save'}</button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h3 className="text-base font-bold text-slate-900">Your backups <span className="font-semibold text-slate-400">· {rows.length}</span></h3>
        {rows.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No backup yet. Press “Download a full backup now” to make the first one.</p>}
        <div className="mt-3 divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{fmtDate(r.created_at)}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${KIND_LABEL[r.kind].cls}`}>{KIND_LABEL[r.kind].label}</span>
                  <span>{fmtSize(r.size_bytes)}</span>
                  <span>{totalRows(r.row_counts).toLocaleString('en-IN')} records in {Object.keys(r.row_counts ?? {}).length} lists</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void download(r)} disabled={!!busy} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{busy === `dl:${r.id}` ? '…' : '⬇ Download'}</button>
                <button type="button" onClick={() => { setTarget({ id: r.id, label: `the backup of ${fmtDate(r.created_at)}` }); setOverwrite(false); setConfirmText(''); setOutcome(null); }} disabled={!!busy} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-60">↩ Restore…</button>
                <button type="button" onClick={() => void remove(r)} disabled={!!busy} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <PictureOptimiser />

      {target && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
            {!outcome ? (
              <>
                <h3 className="text-lg font-bold text-slate-900">Restore {target.label}</h3>
                <p className="mt-2 text-sm text-slate-600">A safety copy of what you have right now is made first, so even a restore can be undone.</p>
                <div className="mt-4 space-y-3">
                  <label className={`block cursor-pointer rounded-xl border-2 p-3 ${!overwrite ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
                    <input type="radio" name="mode" className="mr-2" checked={!overwrite} onChange={() => setOverwrite(false)} />
                    <b className="text-sm text-slate-900">Bring back only what is missing (safe)</b>
                    <span className="mt-1 block pl-5 text-xs text-slate-600">Anything you deleted by mistake comes back. Everything that is there now stays exactly as it is.</span>
                  </label>
                  <label className={`block cursor-pointer rounded-xl border-2 p-3 ${overwrite ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
                    <input type="radio" name="mode" className="mr-2" checked={overwrite} onChange={() => setOverwrite(true)} />
                    <b className="text-sm text-slate-900">Also put edited things back to how they were</b>
                    <span className="mt-1 block pl-5 text-xs text-slate-600">Content you changed after this backup goes back to the backed-up version. People, logins, plans and payments are never touched.</span>
                  </label>
                </div>
                {overwrite && (
                  <label className="mt-4 block text-xs font-semibold text-slate-700">Type RESTORE to confirm
                    <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" autoComplete="off" />
                  </label>
                )}
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={closeRestore} disabled={restoring} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cancel</button>
                  <button type="button" onClick={() => void runRestore()} disabled={restoring || (overwrite && confirmText.trim().toUpperCase() !== 'RESTORE')} className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50">
                    {restoring ? 'Restoring… please wait' : 'Restore now'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-slate-900">{brought > 0 ? '✓ Restore finished' : 'Nothing was missing'}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {brought > 0 ? `${brought.toLocaleString('en-IN')} record(s) are back.` : 'Everything in that backup is already there, so nothing needed to be brought back.'} A safety copy of the earlier state is in your list.
                </p>
                {restoredRows.length > 0 && (
                  <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">What</th><th className="px-3 py-2">Back</th><th className="px-3 py-2">Reset</th><th className="px-3 py-2">Failed</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {restoredRows.map(([t, v]) => (
                          <tr key={t}><td className="px-3 py-1.5 font-medium capitalize text-slate-800">{niceTable(t)}</td><td className="px-3 py-1.5">{v.brought_back ?? 0}</td><td className="px-3 py-1.5">{v.reset_to_backup ?? 0}</td><td className="px-3 py-1.5">{v.skipped ? v.skipped : v.failed ?? 0}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {Object.keys(outcome.result.dropped_or_cleared_links ?? {}).length > 0 && (
                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Some restored items pointed at things that no longer exist (for example a deleted employee); those links were cleared so nothing is left broken.</p>
                )}
                <div className="mt-5 flex justify-end"><button type="button" onClick={closeRestore} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Done</button></div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  );
}
