// Admin card: what happens when an employee finishes the whole induction (every day that applies to them done,
// every test passed). Both outcomes are switches; "Check everyone now" catches up people who finished earlier.

import { useEffect, useState } from 'react';
import { DEFAULT_INDUCTION_SETTINGS, checkEveryoneComplete, getInductionSettings, saveInductionSettings } from '../../repositories/induction/inductionSettingsRepository';
import type { InductionSettings } from '../../repositories/induction/inductionSettingsRepository';

export default function InductionCompletionSettings({ companyId, showToast }: { companyId: string; showToast: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<InductionSettings>(DEFAULT_INDUCTION_SETTINGS);
  const [draft, setDraft] = useState<InductionSettings>(DEFAULT_INDUCTION_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    getInductionSettings(companyId).then((s) => { setSaved(s); setDraft(s); }).catch(() => undefined);
  }, [companyId]);

  const changed = JSON.stringify(draft) !== JSON.stringify(saved);

  async function save() {
    setBusy(true);
    try { await saveInductionSettings(companyId, draft); setSaved(draft); showToast('Saved.'); }
    catch (e) { showToast(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  }

  async function checkAll() {
    setChecking(true);
    try {
      const r = await checkEveryoneComplete();
      showToast(r.completed === 0 && r.certificates === 0 ? 'Checked — nobody new has finished.' : `Done — ${r.completed} induction${r.completed === 1 ? '' : 's'} completed, ${r.certificates} certificate${r.certificates === 1 ? '' : 's'} issued.`);
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not check.'); }
    finally { setChecking(false); }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-sm font-semibold text-slate-700">🎓 When an employee finishes the whole induction</span>
          <span className="block text-xs text-slate-400">
            {saved.certificate_enabled ? `Certificate “${saved.certificate_title}” is issued automatically` : 'No certificate'}{saved.auto_complete ? ' · induction marked completed automatically' : ''}
          </span>
        </span>
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">“Finished” means every day that applies to the employee is completed and every test in those days is passed.</p>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5" checked={draft.certificate_enabled} onChange={(e) => setDraft({ ...draft, certificate_enabled: e.target.checked })} />
            <span>Give them a certificate automatically (it appears in My Certificates and can be downloaded)</span>
          </label>
          {draft.certificate_enabled && (
            <div className="sm:max-w-md">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Name shown on the certificate</label>
              <input value={draft.certificate_title} onChange={(e) => setDraft({ ...draft, certificate_title: e.target.value })} placeholder="Induction Program"
                className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
            </div>
          )}
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5" checked={draft.auto_complete} onChange={(e) => setDraft({ ...draft, auto_complete: e.target.checked })} />
            <span>Mark their induction as completed automatically (no need to press “Mark Complete”)</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5" checked={draft.require_standalone_days} onChange={(e) => setDraft({ ...draft, require_standalone_days: e.target.checked })} />
            <span>Standalone parts (like a company overview) must also be completed <span className="text-slate-400">— switch off if they are only for reading</span></span>
          </label>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" onClick={save} disabled={!changed || busy} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={checkAll} disabled={checking || changed} title={changed ? 'Save your changes first' : undefined} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
              {checking ? 'Checking…' : 'Check everyone now'}
            </button>
            <span className="text-xs text-slate-400">Use this once for people who finished before this was switched on.</span>
          </div>
        </div>
      )}
    </div>
  );
}
