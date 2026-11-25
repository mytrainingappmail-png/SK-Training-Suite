// "Make old pictures lighter" - a card in Admin -> Backup & Restore. Scans the company's card pictures, says how much can be
// saved, and on a button press replaces the heavy ones by light, card-shaped copies (same sharpness).

import { useState } from 'react';
import { optimisePictures, scanPictures } from '../../../services/pictures/pictureOptimiserService';
import type { OptimiseResult, ScanResult } from '../../../services/pictures/pictureOptimiserService';

const mb = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function PictureOptimiser() {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [result, setResult] = useState<OptimiseResult | null>(null);
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'working'>('idle');
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [error, setError] = useState('');

  async function check() {
    setPhase('scanning'); setError(''); setResult(null); setProgress({ done: 0, total: 0 });
    try { setScan(await scanPictures((done, total) => setProgress({ done, total }))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not check the pictures.'); }
    finally { setPhase('idle'); }
  }

  async function run() {
    if (!scan) return;
    setPhase('working'); setError(''); setProgress({ done: 0, total: scan.candidates });
    try { setResult(await optimisePictures(scan, (done, total) => setProgress({ done, total }))); setScan(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setPhase('idle'); }
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const busy = phase !== 'idle';

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h3 className="text-base font-bold text-slate-900">Make old pictures lighter</h3>
      <p className="mt-1 text-sm text-slate-600">
        New card pictures are fitted and made light automatically. This does the same for the pictures you uploaded earlier: same sharpness, much smaller, so cards open faster on phones.
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {!scan && !result && (
        <button type="button" onClick={() => void check()} disabled={busy} className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {phase === 'scanning' ? `Checking your pictures… ${progress.total ? `${progress.done}/${progress.total}` : ''}` : '🔍 Check my pictures'}
        </button>
      )}

      {scan && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p><b>{scan.pictures.length}</b> card pictures, using <b>{mb(scan.totalBytes)}</b>.</p>
            {scan.candidates > 0
              ? <p className="mt-1"><b>{scan.candidates}</b> of them ({mb(scan.candidateBytes)}) can be made lighter.</p>
              : <p className="mt-1 text-emerald-700">✓ All your pictures are already light. Nothing to do.</p>}
            {Object.keys(scan.byKind).length > 0 && (
              <p className="mt-2 text-xs text-slate-500">{Object.entries(scan.byKind).map(([k, n]) => `${k}: ${n}`).join(' · ')}</p>
            )}
          </div>
          {scan.candidates > 0 && (
            <>
              <button type="button" onClick={() => void run()} disabled={busy} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
                {phase === 'working' ? `Making them lighter… ${progress.done}/${progress.total}` : `⚡ Make ${scan.candidates} pictures lighter`}
              </button>
              {phase === 'working' && (
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} /></div>
              )}
              <p className="text-xs text-slate-500">Keep this page open until it finishes. Your old files are kept, so nothing can break.</p>
            </>
          )}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-bold">✓ Done</p>
          <p className="mt-1">{result.changed} picture(s) made lighter: {mb(result.beforeBytes)} → {mb(result.afterBytes)}{result.beforeBytes > 0 ? ` (${Math.round((1 - result.afterBytes / result.beforeBytes) * 100)}% smaller)` : ''}.</p>
          {result.alreadyLight > 0 && <p className="mt-0.5 text-xs">{result.alreadyLight} were already light, so they were left as they are.</p>}
          {result.failed > 0 && <p className="mt-0.5 text-xs text-amber-800">{result.failed} could not be changed and stay as they were. You can run this again.</p>}
          <button type="button" onClick={() => setResult(null)} className="mt-3 text-xs font-semibold text-emerald-800 underline">Check again</button>
        </div>
      )}
    </div>
  );
}
