// src/components/dashboard/TrainerGradingQueue.tsx
//
// Real pending-review queue for subjective (short/long answer)
// questions from the trainer's own students. Awarding marks here
// immediately recomputes the student's real attempt score and result.

import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadGradingQueue, reviewAndRescoreAttempt } from '../../services/trainerWorkspace/gradingQueueService';
import type { GradingQueueItem } from '../../services/trainerWorkspace/gradingQueueService';

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}

function TrainerGradingQueue() {
  const user = getCurrentUser();
  const [queue, setQueue] = useState<GradingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marksDraft, setMarksDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    loadGradingQueue(user.id)
      .then((items) => {
        setQueue(items);
        const initial: Record<string, string> = {};
        items.forEach((item) => { initial[item.answerId] = ''; });
        setMarksDraft(initial);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load grading queue.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAward(item: GradingQueueItem) {
    const raw = marksDraft[item.answerId] ?? '';
    const marks = Number(raw);
    if (raw === '' || Number.isNaN(marks) || marks < 0 || marks > item.maxMarks) {
      showToast(`Enter a number between 0 and ${item.maxMarks}.`);
      return;
    }
    setSavingId(item.answerId);
    try {
      await reviewAndRescoreAttempt(item.answerId, marks, item.attemptId);
      showToast('Marks awarded — student result updated.');
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to award marks.');
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }
  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800">Grading Queue</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Short and long answer questions can't be auto-graded — review each one and award real marks.
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 py-16 text-center text-emerald-700">
          <p className="font-semibold">Nothing to review.</p>
          <p className="mt-1 text-sm">All your students' subjective answers are graded.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => (
            <div key={item.answerId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">{item.employeeName}</p>
                <span className="text-xs text-slate-400">Max {item.maxMarks} marks</span>
              </div>
              <p className="mb-2 text-sm font-medium text-slate-700">{item.questionText}</p>
              <div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                {item.answerText || <span className="italic text-slate-400">No answer provided.</span>}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={item.maxMarks}
                  value={marksDraft[item.answerId] ?? ''}
                  onChange={(e) => setMarksDraft((prev) => ({ ...prev, [item.answerId]: e.target.value }))}
                  placeholder="Marks"
                  className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
                <button
                  onClick={() => handleAward(item)}
                  disabled={savingId === item.answerId}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingId === item.answerId ? <IconSpinner className="h-3.5 w-3.5" /> : null} Award Marks
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default TrainerGradingQueue;
