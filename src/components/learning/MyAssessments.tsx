// src/components/learning/MyAssessments.tsx
//
// Professional Training App Quiz Engine — Dashboard + Quiz + Result +
// Review, all self-contained in this one file.
//
// The actual quiz-taking screen (header, timer, progress bar, question
// palette, single/multiple/true-false options, Previous/Next/Skip/Mark for
// Review/Submit, question & option shuffle, auto-submit) is the existing,
// unmodified components/assessment/AssessmentPlayer.tsx, reused here as a
// child exactly like ContentEditor is reused elsewhere — its internals are
// not touched or duplicated.
//
// Data comes from the existing myAssessmentService (dashboard) and the
// existing assessmentResultService (result screen, filtered client-side to
// this employee/assessment) — no repository, service, or database changes.
// Fields with no existing backing (Module name, Question count, per-
// question review detail for a submitted attempt) are gracefully omitted
// rather than faked, per instructions.

import { useEffect, useMemo, useState } from 'react';
import { loadMyAssessments } from '../../services/myAssessment/myAssessmentService';
import { loadResults }       from '../../services/assessmentResult/assessmentResultService';
import { getCurrentUser }    from '../../services/auth/session';
import AssessmentPlayer      from '../assessment/AssessmentPlayer';
import type { MyAssessment } from '../../types/myAssessment';
import type { AssessmentResult } from '../../types/assessmentResult';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface MyAssessmentsProps {
  onStartAssessment?: (assessmentId: string) => void;
  onViewResult?:      (assessmentId: string, resultId: string | null) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

function statusLabel(a: MyAssessment): string {
  if (a.status === 'completed') return a.passed === false ? 'Failed' : a.passed === true ? 'Passed' : 'Completed';
  if (a.status === 'in_progress') return 'In Progress';
  return 'Not Started';
}

function statusStyles(a: MyAssessment): string {
  if (a.status === 'completed') {
    if (a.passed === false) return 'bg-red-50 text-red-700 ring-1 ring-red-200';
    if (a.passed === true)  return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
    return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  }
  if (a.status === 'in_progress') return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
  return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
}

function StatusBadge({ assessment }: { assessment: MyAssessment }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles(assessment)}`}>
      {statusLabel(assessment)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading / Empty / Error states
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load assessments</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-20 text-center text-slate-400">
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
      </svg>
      <p className="font-medium">
        {search
          ? `No assessments match "${search}".`
          : 'No assessments assigned yet. Your administrator will assign assessments shortly.'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessment card (dashboard)
// ─────────────────────────────────────────────────────────────────────────────

// Rotating gradient palette so cards read as colorful, quiz-themed.
const ASSESSMENT_GRADIENTS = [
  'from-indigo-500 to-violet-500',
  'from-rose-500 to-orange-400',
  'from-emerald-500 to-teal-400',
  'from-sky-500 to-cyan-400',
];

function IconQuiz({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17.25h.007v.008H12v-.008Z" />
    </svg>
  );
}

function AssessmentCard({
  assessment, index, onStart, onViewResult,
}: {
  assessment:   MyAssessment;
  index:        number;
  onStart:      (assessment: MyAssessment) => void;
  onViewResult: (assessment: MyAssessment) => void;
}) {
  const isCompleted  = assessment.status === 'completed';
  const isInProgress = assessment.status === 'in_progress';
  const passingPercent =
    assessment.totalMarks > 0 ? Math.round((assessment.passingMarks / assessment.totalMarks) * 100) : null;
  const attemptsExhausted = assessment.attemptCount >= assessment.maximumAttempts;
  const gradient = ASSESSMENT_GRADIENTS[index % ASSESSMENT_GRADIENTS.length];

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl">

      <div className={`relative h-16 bg-gradient-to-r ${gradient}`}>
        <div className="absolute -bottom-5 left-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-md ring-4 ring-white">
          <IconQuiz className="h-6 w-6" />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 pt-8">

      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-800">{assessment.assessmentTitle}</p>
          {assessment.assessmentCode && (
            <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
              {assessment.assessmentCode}
            </span>
          )}
        </div>
        <StatusBadge assessment={assessment} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-y-2 text-xs text-slate-500">
        <div>
          <p className="text-slate-400">Duration</p>
          <p className="font-medium text-slate-700">
            {assessment.durationMinutes > 0 ? `${assessment.durationMinutes} min` : '—'}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Passing %</p>
          <p className="font-medium text-slate-700">{passingPercent !== null ? `${passingPercent}%` : '—'}</p>
        </div>
        <div>
          <p className="text-slate-400">Attempts Allowed</p>
          <p className="font-medium text-slate-700">{assessment.maximumAttempts}</p>
        </div>
        <div>
          <p className="text-slate-400">Attempts Used</p>
          <p className="font-medium text-slate-700">{assessment.attemptCount}</p>
        </div>
        <div>
          <p className="text-slate-400">Due Date</p>
          <p className="font-medium text-slate-700">
            {assessment.dueDate ? new Date(assessment.dueDate).toLocaleDateString() : '—'}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Last Attempt</p>
          <p className="font-medium text-slate-700">
            {assessment.lastAttemptDate ? new Date(assessment.lastAttemptDate).toLocaleDateString() : '—'}
          </p>
        </div>
      </div>

      {isCompleted && assessment.percentage !== null && (
        <div
          className={`mb-4 rounded-xl px-3 py-2 text-xs font-semibold ${
            assessment.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          Scored {assessment.percentage.toFixed(1)}% — {assessment.passed ? 'Passed' : 'Not Passed'}
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        {(!isCompleted || (isCompleted && !attemptsExhausted)) && (
          <button
            onClick={() => onStart(assessment)}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${gradient} px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md active:scale-95`}
          >
            {isInProgress ? 'Continue Assessment' : isCompleted ? 'Retake Assessment' : 'Start Assessment'}
          </button>
        )}

        {isCompleted && (
          <button
            onClick={() => onViewResult(assessment)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            View Result
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Result Screen
// ─────────────────────────────────────────────────────────────────────────────

function ResultScreen({
  assessment, result, resultLoading, onReview, onRetake, onBackToDashboard,
}: {
  assessment:    MyAssessment;
  result:        AssessmentResult | null;
  resultLoading: boolean;
  onReview:      () => void;
  onRetake:      () => void;
  onBackToDashboard: () => void;
}) {
  const attemptsExhausted = assessment.attemptCount >= assessment.maximumAttempts;

  function handleDownload() {
    if (!result) return;
    const lines = [
      `Assessment: ${assessment.assessmentTitle}`,
      `Code: ${assessment.assessmentCode || '—'}`,
      `Score: ${result.obtained_marks} / ${result.total_marks} (${result.percentage.toFixed(1)}%)`,
      `Result: ${result.passed ? 'Passed' : 'Failed'}`,
      result.grade ? `Grade: ${result.grade}` : '',
      result.rank > 0 ? `Rank: ${result.rank}` : '',
      `Evaluated: ${result.evaluated_at ? new Date(result.evaluated_at).toLocaleString() : '—'}`,
    ].filter(Boolean);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${assessment.assessmentTitle.replace(/[^a-z0-9]+/gi, '_')}_result.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
      <button
        onClick={onBackToDashboard}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to My Assessments
      </button>

      <h2 className="mb-1 text-2xl font-bold text-slate-800">{assessment.assessmentTitle}</h2>
      <p className="mb-8 text-slate-500">Result Summary</p>

      {resultLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      )}

      {!resultLoading && !result && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
          <p className="font-medium">Your result is being evaluated.</p>
          <p className="mt-1 text-sm">Check back soon — this page will show your score once it's published.</p>
        </div>
      )}

      {!resultLoading && result && (
        <>
          <div
            className={`mb-8 flex flex-col items-center justify-center gap-2 rounded-2xl p-8 text-center ${
              result.passed ? 'bg-emerald-50' : 'bg-red-50'
            }`}
          >
            <p className={`text-5xl font-bold ${result.passed ? 'text-emerald-600' : 'text-red-600'}`}>
              {result.percentage.toFixed(1)}%
            </p>
            <p className={`text-lg font-semibold ${result.passed ? 'text-emerald-700' : 'text-red-700'}`}>
              {result.passed ? 'Passed' : 'Failed'}
            </p>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Obtained Marks</p>
              <p className="mt-1 text-xl font-bold text-slate-800">{result.obtained_marks}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Marks</p>
              <p className="mt-1 text-xl font-bold text-slate-800">{result.total_marks}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Grade</p>
              <p className="mt-1 text-xl font-bold text-slate-800">{result.grade || '—'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rank</p>
              <p className="mt-1 text-xl font-bold text-slate-800">{result.rank > 0 ? `#${result.rank}` : '—'}</p>
            </div>
          </div>

          <p className="mb-8 text-center text-sm text-slate-400">
            Evaluated {result.evaluated_at ? new Date(result.evaluated_at).toLocaleString() : '—'}
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Download Result
            </button>
            <button
              onClick={onReview}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Review Answers
            </button>
            {!attemptsExhausted && (
              <button
                onClick={onRetake}
                className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
              >
                Retake Assessment
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Review Mode
// ─────────────────────────────────────────────────────────────────────────────

function ReviewScreen({ assessment, onBack }: { assessment: MyAssessment; onBack: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to Result
      </button>

      <h2 className="mb-1 text-2xl font-bold text-slate-800">{assessment.assessmentTitle}</h2>
      <p className="mb-8 text-slate-500">Review Mode</p>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-20 text-center text-slate-400">
        <svg className="mb-4 h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292v-14.25" />
        </svg>
        <p className="font-medium text-slate-500">Detailed question-by-question review isn't available for submitted attempts yet.</p>
        <p className="mt-1 max-w-sm text-sm">Your score and pass/fail outcome are shown on the Result screen.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main MyAssessments — Dashboard / Quiz / Result / Review state machine
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode = 'dashboard' | 'quiz' | 'result' | 'review';

function MyAssessments({ onStartAssessment, onViewResult }: MyAssessmentsProps) {
  const user = getCurrentUser();

  const [assessments, setAssessments] = useState<MyAssessment[]>([]);
  const [loading,      setLoading]    = useState(true);
  const [error,        setError]      = useState('');
  const [search,       setSearch]     = useState('');

  const [view, setView] = useState<ViewMode>('dashboard');
  const [activeAssessment, setActiveAssessment] = useState<MyAssessment | null>(null);

  const [result,        setResult]        = useState<AssessmentResult | null>(null);
  const [resultLoading, setResultLoading]  = useState(false);

  function fetchAssessments() {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    loadMyAssessments(user.id)
      .then(setAssessments)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load assessments.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAssessments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return assessments;
    return assessments.filter(
      (a) =>
        a.assessmentTitle.toLowerCase().includes(kw) ||
        a.assessmentCode.toLowerCase().includes(kw)
    );
  }, [search, assessments]);

  function fetchResult(assessment: MyAssessment) {
    if (!user?.id) return;
    setResultLoading(true);
    loadResults()
      .then((all) => {
        const matches = all
          .filter((r) => r.assessment_id === assessment.assessmentId && r.employee_id === user.id)
          .sort((a, b) => new Date(b.evaluated_at).getTime() - new Date(a.evaluated_at).getTime());
        setResult(matches[0] ?? null);
      })
      .catch(() => setResult(null))
      .finally(() => setResultLoading(false));
  }

  function handleStart(assessment: MyAssessment) {
    onStartAssessment?.(assessment.assessmentId);
    setActiveAssessment(assessment);
    setResult(null);
    setView('quiz');
  }

  function handleQuizFinish() {
    if (!activeAssessment) {
      setView('dashboard');
      return;
    }
    fetchAssessments();
    fetchResult(activeAssessment);
    setView('result');
  }

  function handleViewResult(assessment: MyAssessment) {
    onViewResult?.(assessment.assessmentId, assessment.resultId);
    setActiveAssessment(assessment);
    fetchResult(assessment);
    setView('result');
  }

  function handleRetake() {
    if (!activeAssessment) return;
    setResult(null);
    setView('quiz');
  }

  function handleBackToDashboard() {
    setActiveAssessment(null);
    setResult(null);
    setView('dashboard');
    fetchAssessments();
  }

  // ── Quiz view — existing AssessmentPlayer, unmodified, reused ──────────────

  if (view === 'quiz' && activeAssessment && user?.id) {
    return (
      <AssessmentPlayer
        assessmentId={activeAssessment.assessmentId}
        employeeId={user.id}
        onFinish={handleQuizFinish}
      />
    );
  }

  // ── Result view ─────────────────────────────────────────────────────────────

  if (view === 'result' && activeAssessment) {
    return (
      <ResultScreen
        assessment={activeAssessment}
        result={result}
        resultLoading={resultLoading}
        onReview={() => setView('review')}
        onRetake={handleRetake}
        onBackToDashboard={handleBackToDashboard}
      />
    );
  }

  // ── Review view ──────────────────────────────────────────────────────────────

  if (view === 'review' && activeAssessment) {
    return <ReviewScreen assessment={activeAssessment} onBack={() => setView('result')} />;
  }

  // ── Dashboard view ───────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">My Assessments</h2>
          <p className="mt-1 text-slate-500">All assessments assigned to you.</p>
        </div>
      </div>

      <div className="mb-6">
        <input
          className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-100"
          placeholder="Search by assessment title or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <ErrorState message={error} />}

      {loading && <Skeleton />}

      {!loading && !error && filtered.length === 0 && <EmptyState search={search} />}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((assessment, index) => (
            <AssessmentCard
              key={assessment.assignmentId}
              assessment={assessment}
              index={index}
              onStart={handleStart}
              onViewResult={handleViewResult}
            />
          ))}
        </div>
      )}

    </div>
  );
}

export default MyAssessments;
