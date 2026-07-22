// src/components/dashboard/TrainerBatches.tsx
//
// Real "My Batches" — every batch a Trainer is assigned to, with real
// status, dates, student count, and average completion.

import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadTrainerBatchDetails } from '../../services/trainerWorkspace/trainerBatchesService';
import type { TrainerBatchDetail } from '../../services/trainerWorkspace/trainerBatchesService';
import type { BatchStatus } from '../../types/trainingBatch';

const STATUS_STYLES: Record<BatchStatus, string> = {
  PLANNED: 'bg-blue-50 text-blue-700',
  ONGOING: 'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-red-50 text-red-700',
};

function TrainerBatches() {
  const user = getCurrentUser();
  const [batches, setBatches] = useState<TrainerBatchDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<BatchStatus | 'ALL'>('ALL');

  useEffect(() => {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }
    loadTrainerBatchDetails(user.id)
      .then(setBatches)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load batches.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = statusFilter === 'ALL' ? batches : batches.filter((b) => b.status === statusFilter);

  const summary = {
    total: batches.length,
    ongoing: batches.filter((b) => b.status === 'ONGOING').length,
    completed: batches.filter((b) => b.status === 'COMPLETED').length,
    planned: batches.filter((b) => b.status === 'PLANNED').length,
  };

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }
  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800">My Batches</h2>
        <p className="mt-0.5 text-sm text-slate-500">Every batch assigned to you — planned, ongoing, and completed.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { key: 'ALL' as const, label: 'All', value: summary.total, cls: 'border-slate-200' },
          { key: 'ONGOING' as const, label: 'Ongoing', value: summary.ongoing, cls: 'border-amber-200' },
          { key: 'COMPLETED' as const, label: 'Completed', value: summary.completed, cls: 'border-emerald-200' },
          { key: 'PLANNED' as const, label: 'Planned', value: summary.planned, cls: 'border-blue-200' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition ${s.cls} ${statusFilter === s.key ? 'ring-2 ring-indigo-400' : ''}`}
          >
            <p className="text-2xl font-bold text-slate-800">{s.value}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
          No batches match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.batchId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{b.batchName}</p>
                  <p className="font-mono text-xs text-slate-400">{b.batchCode} · {b.courseName}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[b.status]}`}>{b.status}</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <p>{b.startDate ? new Date(b.startDate).toLocaleDateString() : '—'} – {b.endDate ? new Date(b.endDate).toLocaleDateString() : '—'}</p>
                <p>{b.enrolledStudents} / {b.capacity || '∞'} students</p>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500">Average Completion</span>
                  <span className="font-semibold text-slate-700">{b.averageCompletion}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${b.averageCompletion}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TrainerBatches;
