// src/components/dashboard/TrainerResults.tsx
//
// Real, filterable student results — search by name/assessment,
// filter by pass/fail, real CSV export (built in the browser, no
// external service).

import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadTrainerResults, exportResultsToCsv } from '../../services/trainerWorkspace/trainerResultsService';
import type { TrainerResultRow } from '../../services/trainerWorkspace/trainerResultsService';

function IconDownload({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 12m0 0 4.5-4.5M12 12V3" /></svg>);
}

function TrainerResults() {
  const user = getCurrentUser();
  const [results, setResults] = useState<TrainerResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'pass' | 'fail'>('all');

  useEffect(() => {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }
    loadTrainerResults(user.id)
      .then(setResults)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load results.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchTerm = search.trim().toLowerCase();
  const filtered = results.filter((r) => {
    if (resultFilter === 'pass' && !r.passed) return false;
    if (resultFilter === 'fail' && r.passed) return false;
    if (!searchTerm) return true;
    return r.employeeName.toLowerCase().includes(searchTerm) || r.assessmentTitle.toLowerCase().includes(searchTerm);
  });

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }
  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Student Results</h2>
          <p className="mt-0.5 text-sm text-slate-500">Assessment results for every student you teach.</p>
        </div>
        <button
          onClick={() => exportResultsToCsv(filtered)}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconDownload /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by student or assessment…"
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
        />
        <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value as 'all' | 'pass' | 'fail')}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30">
          <option value="all">All Results</option>
          <option value="pass">Pass Only</option>
          <option value="fail">Fail Only</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
          No results match.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Assessment</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Score</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Result</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Grade</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((r, i) => (
                <tr key={`${r.employeeId}-${i}`} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.employeeName}</td>
                  <td className="px-4 py-3 text-slate-600">{r.assessmentTitle}</td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700">{r.percentage}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {r.passed ? 'Pass' : 'Fail'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{r.grade}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{r.evaluatedAt ? new Date(r.evaluatedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TrainerResults;
