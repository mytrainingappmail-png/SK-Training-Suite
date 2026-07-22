// src/components/dashboard/TrainerDashboard.tsx
//
// Dynamic, professional Trainer Dashboard — real clickable summary
// cards (navigate to the relevant Teaching page), a real batch
// completion bar chart, and a real pass/fail donut chart. Every number
// comes from the same real services the Teaching pages themselves use.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../services/auth/session';
import { loadTrainerDashboard } from '../../services/trainerDashboard/trainerDashboardService';
import { loadTrainerCourses } from '../../services/trainerWorkspace/trainerCoursesService';
import { loadTrainerBatchDetails } from '../../services/trainerWorkspace/trainerBatchesService';
import { loadTrainerResults } from '../../services/trainerWorkspace/trainerResultsService';
import { loadGradingQueue } from '../../services/trainerWorkspace/gradingQueueService';
import { ROUTES } from '../../constants/routes';
import { MiniBarChart, MiniDonutChart, ClickableStatCard } from '../shared/MiniCharts';
import type { TrainerDashboardData } from '../../services/trainerDashboard/trainerDashboardService';
import type { TrainerCourseRow } from '../../services/trainerWorkspace/trainerCoursesService';
import type { TrainerBatchDetail } from '../../services/trainerWorkspace/trainerBatchesService';

function Skeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-32 rounded-2xl bg-slate-100" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-100" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-2xl bg-slate-100" />
        <div className="h-72 rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function TrainerDashboard() {
  const user = getCurrentUser();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<TrainerDashboardData | null>(null);
  const [courses, setCourses] = useState<TrainerCourseRow[]>([]);
  const [batches, setBatches] = useState<TrainerBatchDetail[]>([]);
  const [passCount, setPassCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [pendingGrading, setPendingGrading] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    Promise.all([
      loadTrainerDashboard(user.id),
      loadTrainerCourses(user.id),
      loadTrainerBatchDetails(user.id),
      loadTrainerResults(user.id),
      loadGradingQueue(user.id),
    ])
      .then(([dashboardData, courseRows, batchRows, resultRows, gradingItems]) => {
        setSummary(dashboardData);
        setCourses(courseRows);
        setBatches(batchRows);
        setPassCount(resultRows.filter((r) => r.passed).length);
        setFailCount(resultRows.filter((r) => !r.passed).length);
        setPendingGrading(gradingItems.length);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Skeleton />;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  if (!summary) return null;

  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Trainer';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const batchChartData = batches.slice(0, 8).map((b) => ({ label: b.batchName, value: b.averageCompletion }));
  const courseChartData = courses.slice(0, 8).map((c) => ({ label: c.courseName, value: c.totalStudents }));

  return (
    <div className="space-y-6">

      <div
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6 text-white shadow-md"
        style={{ background: 'linear-gradient(135deg, #4338CA 0%, #7C3AED 100%)' }}
      >
        <div>
          <p className="text-sm text-indigo-100">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <h1 className="text-2xl font-bold">{greeting}, {fullName} 👋</h1>
          <p className="text-sm text-indigo-100">Here's what's happening with your training batches.</p>
        </div>
        {pendingGrading > 0 && (
          <button
            onClick={() => navigate(ROUTES.TRAINER_GRADING_QUEUE)}
            className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
          >
            {pendingGrading} answer{pendingGrading === 1 ? '' : 's'} waiting for review →
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ClickableStatCard label="Active Batches" value={summary.activeBatchCount} className="border-indigo-100" onClick={() => navigate(ROUTES.TRAINER_BATCHES)} />
        <ClickableStatCard label="Courses Teaching" value={summary.courseCount} className="border-violet-100" onClick={() => navigate(ROUTES.TRAINER_COURSES)} />
        <ClickableStatCard label="Total Students" value={summary.totalStudents} className="border-emerald-100" onClick={() => navigate(ROUTES.TRAINER_STUDENTS)} />
        <ClickableStatCard label="Pending Grading" value={pendingGrading} className="border-amber-100" onClick={() => navigate(ROUTES.TRAINER_GRADING_QUEUE)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800">Batch Completion</h3>
            <button onClick={() => navigate(ROUTES.TRAINER_BATCHES)} className="text-xs font-semibold text-indigo-600 hover:underline">View all →</button>
          </div>
          <MiniBarChart data={batchChartData} color="#6366F1" maxValue={100} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800">Pass / Fail Ratio</h3>
            <button onClick={() => navigate(ROUTES.TRAINER_RESULTS)} className="text-xs font-semibold text-indigo-600 hover:underline">View all →</button>
          </div>
          <MiniDonutChart data={[
            { label: 'Pass', value: passCount, color: '#10B981' },
            { label: 'Fail', value: failCount, color: '#EF4444' },
          ]} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Students per Course</h3>
          <button onClick={() => navigate(ROUTES.TRAINER_COURSES)} className="text-xs font-semibold text-indigo-600 hover:underline">View all →</button>
        </div>
        <MiniBarChart data={courseChartData} color="#8B5CF6" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-800">My Training Batches</h2>
          <button onClick={() => navigate(ROUTES.TRAINER_BATCHES)} className="text-xs font-semibold text-indigo-600 hover:underline">View all →</button>
        </div>
        {summary.batches.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">No batches assigned to you yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {summary.batches.map((batch) => (
              <button
                key={batch.batchId}
                onClick={() => navigate(ROUTES.TRAINER_BATCHES)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-6 py-4 text-left transition hover:bg-slate-50/60"
              >
                <div>
                  <p className="font-semibold text-slate-800">{batch.batchName}</p>
                  <p className="text-xs text-slate-500">{batch.courseName}</p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p>{batch.startDate ? new Date(batch.startDate).toLocaleDateString() : '—'} – {batch.endDate ? new Date(batch.endDate).toLocaleDateString() : '—'}</p>
                  <p className="mt-1 font-semibold text-slate-600">{batch.enrolledCount} student(s)</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

export default TrainerDashboard;
