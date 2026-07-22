// src/components/dashboard/TrainerStudents.tsx
//
// Real roster of every student across a trainer's assigned batches,
// with real per-student course progress.

import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadTrainerStudents } from '../../services/trainerWorkspace/trainerStudentsService';
import type { TrainerStudentRow } from '../../services/trainerWorkspace/trainerStudentsService';

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const colour = pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-yellow-400' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs font-semibold text-slate-600">{pct}%</span>
    </div>
  );
}

function TrainerStudents() {
  const user = getCurrentUser();
  const [students, setStudents] = useState<TrainerStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }
    setLoading(true);
    loadTrainerStudents(user.id)
      .then(setStudents)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load students.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchTerm = search.trim().toLowerCase();
  const filtered = students.filter(
    (s) => !searchTerm || s.employeeName.toLowerCase().includes(searchTerm) || s.courseName.toLowerCase().includes(searchTerm)
  );

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }
  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800">My Students</h2>
        <p className="mt-0.5 text-sm text-slate-500">Every student enrolled in a course you teach.</p>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or course…"
        className="mb-4 w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          {search ? `No students match "${search}".` : 'No students in your courses yet.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Course</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Progress</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((s, i) => (
                <tr key={`${s.employeeId}-${i}`} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{s.employeeName}</p>
                    <p className="font-mono text-xs text-slate-400">{s.employeeCode}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.courseName}</td>
                  <td className="px-4 py-3"><ProgressBar value={s.completionPercentage} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TrainerStudents;
