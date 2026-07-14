import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  startAssessment,
  saveQuestionAnswer,
  submitAssessment,
} from "../../services/assessmentPlayer/assessmentPlayerService";

import type {
  AssessmentPlayerPayload,
  LocalAnswer,
  PlayerQuestion,
  QuestionState,
} from "../../types/assessmentPlayer";
import type { QuestionOption } from "../../types/question";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface AssessmentPlayerProps {
  assessmentId: string;
  employeeId: string;
  onFinish: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Palette colours
// ─────────────────────────────────────────────────────────────────────────────

function paletteCls(state: QuestionState, isCurrent: boolean): string {
  if (isCurrent)
    return "bg-yellow-500 text-slate-900 ring-2 ring-yellow-600 font-bold";
  if (state === "answered")
    return "bg-emerald-500 text-white";
  if (state === "skipped")
    return "bg-slate-400 text-white";
  return "bg-white text-slate-600 border border-slate-300";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function buildInitialAnswers(
  questions: PlayerQuestion[],
  existingAnswers: AssessmentPlayerPayload["existingAnswers"]
): Record<string, LocalAnswer> {
  const map: Record<string, LocalAnswer> = {};
  for (const q of questions) {
    const existing = existingAnswers.find((a) => a.question_id === q.id);
    const hasAnswer =
  existing &&
  (existing.selected_option_ids.length > 0 ||
   existing.answer_text.trim().length > 0);
    map[q.id] = {
      questionId:        q.id,
      selectedOptionIds: existing?.selected_option_ids ?? [],
      textAnswer: existing?.answer_text ?? "",
      isSkipped:         existing?.is_skipped ?? false,
      timeTakenSeconds:  existing?.time_taken_seconds ?? 0,
      state: hasAnswer
        ? "answered"
        : existing?.is_skipped
        ? "skipped"
        : "not_visited",
    };
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading screen
// ─────────────────────────────────────────────────────────────────────────────

function Loader() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-900">
      <div className="text-center">
        <svg
          className="mx-auto mb-4 h-10 w-10 animate-spin text-yellow-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
        <p className="text-sm text-slate-400">Loading assessment…</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Error screen
// ─────────────────────────────────────────────────────────────────────────────

function ErrorScreen({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-900">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="mb-2 text-lg font-bold text-slate-800">Unable to load assessment</h2>
        <p className="mb-6 text-sm text-slate-500">{message}</p>
        <button
          onClick={onBack}
          className="rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm submit dialog
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmDialog({
  answeredCount,
  skippedCount,
  totalCount,
  onConfirm,
  onCancel,
}: {
  answeredCount: number;
  skippedCount: number;
  totalCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const unanswered = totalCount - answeredCount - skippedCount;
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-1 text-lg font-bold text-slate-800">Submit Assessment?</h3>
        <p className="mb-5 text-sm text-slate-500">Please review your progress before submitting.</p>

        <div className="mb-6 grid grid-cols-3 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{answeredCount}</p>
            <p className="text-xs text-slate-500">Answered</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-500">{skippedCount}</p>
            <p className="text-xs text-slate-500">Skipped</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-500">{unanswered}</p>
            <p className="text-xs text-slate-500">Not Answered</p>
          </div>
        </div>

        {unanswered > 0 && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            You have {unanswered} unanswered {unanswered === 1 ? "question" : "questions"}.
            These will be marked as not attempted.
          </div>
        )}

        <div className="flex gap-3">
          <button ref={cancelRef} onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            Review Answers
          </button>
          <button onClick={onConfirm}
            className="flex-1 rounded-xl bg-yellow-500 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400">
            Submit Now
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Question renderer
// ─────────────────────────────────────────────────────────────────────────────

function QuestionRenderer({
  question,
  localAnswer,
  disabled,
  onChange,
}: {
  question: PlayerQuestion;
  localAnswer: LocalAnswer;
  disabled: boolean;
  onChange: (updated: Partial<LocalAnswer>) => void;
}) {
  const qt = question.question_type;

  function toggleOption(optId: string) {
    if (qt === "mcq" || qt === "true_false") {
      onChange({ selectedOptionIds: [optId], textAnswer: "", isSkipped: false });
    } else if (qt === "multiple_select") {
      const current = localAnswer.selectedOptionIds;
      const next = current.includes(optId)
        ? current.filter((id) => id !== optId)
        : [...current, optId];
      onChange({ selectedOptionIds: next, textAnswer: "", isSkipped: false });
    }
  }

  function isSelected(optId: string) {
    return localAnswer.selectedOptionIds.includes(optId);
  }

  if (qt === "mcq" || qt === "true_false" || qt === "multiple_select") {
    return (
      <div className="space-y-3">
        {question.options.map((opt: QuestionOption) => {
          const selected = isSelected(opt.id);
          const isMulti = qt === "multiple_select";
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => !disabled && toggleOption(opt.id)}
              disabled={disabled}
              className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm transition ${
                selected
                  ? "border-yellow-400 bg-yellow-50 text-slate-800"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center ${
                    isMulti ? "rounded" : "rounded-full"
                  } border-2 ${
                    selected
                      ? "border-yellow-500 bg-yellow-500 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {selected && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </span>
                <span>{opt.option_text}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  if (qt === "fill_blank" || qt === "short_answer") {
    return (
      <input
        type="text"
        value={localAnswer.textAnswer}
        onChange={(e) =>
          !disabled && onChange({ textAnswer: e.target.value, selectedOptionIds: [], isSkipped: false })
        }
        disabled={disabled}
        placeholder={qt === "fill_blank" ? "Type your answer…" : "Write your answer…"}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:bg-slate-50"
      />
    );
  }

  if (qt === "long_answer") {
    return (
      <textarea
        value={localAnswer.textAnswer}
        onChange={(e) =>
          !disabled && onChange({ textAnswer: e.target.value, selectedOptionIds: [], isSkipped: false })
        }
        disabled={disabled}
        placeholder="Write your detailed answer here…"
        rows={6}
        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:bg-slate-50"
      />
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main AssessmentPlayer component
// ─────────────────────────────────────────────────────────────────────────────

export default function AssessmentPlayer({
  assessmentId,
  employeeId,
  onFinish,
}: AssessmentPlayerProps) {

  // ── Loading / error state
  const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // ── Payload
  const [payload, setPayload] = useState<AssessmentPlayerPayload | null>(null);

  // ── Navigation
  const [currentIdx, setCurrentIdx] = useState(0);

  // ── Answers
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});

  // ── Timers
  const [overallSecondsLeft, setOverallSecondsLeft] = useState(0);
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // ── UI state
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Refs for timers
  const overallTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savingRef        = useRef(false);

  // ── Load on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await startAssessment(assessmentId, employeeId);
        if (cancelled) return;

        const initialAnswers = buildInitialAnswers(p.questions, p.existingAnswers);
        setPayload(p);
        setAnswers(initialAnswers);

        const totalSecs = p.assessment.duration_minutes * 60;
        setOverallSecondsLeft(totalSecs);

        if (p.assessment.question_timer_enabled) {
          setQuestionSecondsLeft(p.assessment.question_time_seconds);
        }

        setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "Failed to load assessment.");
          setStatus("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [assessmentId, employeeId]);

  // ── Warn before leaving page
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (status === "ready") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [status]);

  // ── Overall timer
  useEffect(() => {
    if (status !== "ready" || !payload) return;
    if (overallSecondsLeft <= 0) return;

    overallTimerRef.current = setInterval(() => {
      setOverallSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(overallTimerRef.current!);
          if (payload.assessment.auto_submit) {
            handleAutoSubmit("timed_out");
          }
          return 0;
        }
        return prev - 1;
      });
      setElapsedSeconds((e) => e + 1);
    }, 1000);

    return () => { if (overallTimerRef.current) clearInterval(overallTimerRef.current); };
  }, [status]);

  // ── Per-question timer
  useEffect(() => {
    if (status !== "ready" || !payload?.assessment.question_timer_enabled) return;

    setQuestionSecondsLeft(payload.assessment.question_time_seconds);

    questionTimerRef.current = setInterval(() => {
      setQuestionSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(questionTimerRef.current!);
          // Auto-advance to next question
          setCurrentIdx((idx) => {
            const next = idx + 1;
            if (payload && next < payload.questions.length) {
              setQuestionSecondsLeft(payload.assessment.question_time_seconds);
              return next;
            }
            return idx;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (questionTimerRef.current) clearInterval(questionTimerRef.current); };
  }, [currentIdx, status]);

  // ── Save answer to server (debounced via ref flag)
  const persistAnswer = useCallback(
    async (questionId: string, answer: LocalAnswer) => {
      if (!payload || savingRef.current) return;
      savingRef.current = true;
      try {
        await saveQuestionAnswer({
          attemptId:         payload.attempt.id,
          questionId,
          selectedOptionIds: answer.selectedOptionIds,
          textAnswer:        answer.textAnswer,
          isSkipped:         answer.isSkipped,
          timeTakenSeconds:  answer.timeTakenSeconds,
        });
      } catch {
        // Silent fail — answer is still in local state
      } finally {
        savingRef.current = false;
      }
    },
    [payload]
  );

  // ── Update local answer
  function updateAnswer(questionId: string, update: Partial<LocalAnswer>) {
    setAnswers((prev) => {
      const existing = prev[questionId];
      const updated: LocalAnswer = {
        ...existing,
        ...update,
        state: update.isSkipped
          ? "skipped"
          : (update.selectedOptionIds ?? existing.selectedOptionIds).length > 0 ||
            (update.textAnswer ?? existing.textAnswer).trim().length > 0
          ? "answered"
          : "not_visited",
      };
      persistAnswer(questionId, updated);
      return { ...prev, [questionId]: updated };
    });
  }

  // ── Navigation
  function goTo(idx: number) {
    if (!payload) return;
    if (idx < 0 || idx >= payload.questions.length) return;
    setCurrentIdx(idx);
  }

  function skipQuestion() {
    if (!payload) return;
    const q = payload.questions[currentIdx];
    updateAnswer(q.id, { isSkipped: true, selectedOptionIds: [], textAnswer: "" });
    if (currentIdx < payload.questions.length - 1) goTo(currentIdx + 1);
  }

  // ── Submit
  async function handleAutoSubmit(reason: "timed_out" | "submitted") {
    if (!payload || status === "submitting" || status === "done") return;
    setStatus("submitting");
    try {
      await submitAssessment({
        attemptId:         payload.attempt.id,
        timeTakenSeconds:  elapsedSeconds,
        status:            reason,
      });
      setStatus("done");
      onFinish();
    } catch {
      setStatus("ready");
    }
  }

  async function handleConfirmSubmit() {
    setShowConfirm(false);
    await handleAutoSubmit("submitted");
  }

  // ── Derived counts
  const answeredCount = Object.values(answers).filter((a) => a.state === "answered").length;
  const skippedCount  = Object.values(answers).filter((a) => a.state === "skipped").length;
  const totalCount    = payload?.questions.length ?? 0;
  const progress      = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  // ── Mark current question in palette
  const currentQuestion = payload?.questions[currentIdx] ?? null;

  function getQuestionState(q: PlayerQuestion): QuestionState {
    if (!answers[q.id]) return "not_visited";
    if (q.id === currentQuestion?.id) return "current";
    return answers[q.id].state;
  }

  // ─── Render states ────────────────────────────────────────────────────────

  if (status === "loading") return <Loader />;
  if (status === "error")   return <ErrorScreen message={errorMsg} onBack={onFinish} />;
  if (!payload || !currentQuestion) return <Loader />;

  const { assessment, questions } = payload;
  const localAnswer = answers[currentQuestion.id] ?? {
    questionId: currentQuestion.id,
    selectedOptionIds: [],
    textAnswer: "",
    isSkipped: false,
    timeTakenSeconds: 0,
    state: "not_visited" as QuestionState,
  };

  const timerWarning = overallSecondsLeft > 0 && overallSecondsLeft <= 120;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-900 text-white">

      {/* ── Header ── */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-700 bg-slate-800 px-6 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-white">{assessment.assessment_title}</h1>
          <p className="text-xs text-slate-400">
            Question {currentIdx + 1} of {totalCount}
          </p>
        </div>

        {/* Overall timer */}
        {overallSecondsLeft > 0 && (
          <div
            className={`mx-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
              timerWarning ? "bg-red-600 text-white" : "bg-slate-700 text-white"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            {formatTime(overallSecondsLeft)}
          </div>
        )}

        <button
          onClick={() => setShowConfirm(true)}
          disabled={status === "submitting"}
          className="flex-shrink-0 rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:opacity-50"
        >
          {status === "submitting" ? "Submitting…" : "Finish Assessment"}
        </button>
      </header>

      {/* ── Progress bar ── */}
      <div className="h-1 w-full bg-slate-700">
        <div
          className="h-full bg-yellow-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Question Panel ── */}
        <main className="flex flex-1 flex-col overflow-y-auto p-6">

          {/* Per-question timer */}
          {assessment.question_timer_enabled && questionSecondsLeft > 0 && (
            <div className={`mb-4 inline-flex w-fit items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold ${
              questionSecondsLeft <= 10 ? "bg-red-600 text-white" : "bg-slate-700 text-white"
            }`}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              {questionSecondsLeft}s
            </div>
          )}

          {/* Question header */}
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-700 px-3 py-0.5 text-xs font-medium text-slate-300">
                {currentQuestion.question_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
              <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                currentQuestion.difficulty_level === "easy"   ? "bg-green-800 text-green-200" :
                currentQuestion.difficulty_level === "medium" ? "bg-amber-800 text-amber-200" :
                                                                "bg-red-800 text-red-200"
              }`}>
                {currentQuestion.difficulty_level.charAt(0).toUpperCase() + currentQuestion.difficulty_level.slice(1)}
              </span>
              <span className="rounded-full bg-slate-700 px-3 py-0.5 text-xs font-medium text-slate-300">
                {currentQuestion.marks} {currentQuestion.marks === 1 ? "mark" : "marks"}
              </span>
              {currentQuestion.mandatory && (
                <span className="rounded-full bg-red-800 px-3 py-0.5 text-xs font-medium text-red-200">
                  Mandatory
                </span>
              )}
            </div>
          </div>

          {/* Image */}
          {currentQuestion.image_url && (
            <div className="mb-4">
              <img
                src={currentQuestion.image_url}
                alt="Question illustration"
                className="max-h-48 rounded-xl object-contain"
              />
            </div>
          )}

          {/* Question text */}
          <div className="mb-6 text-base font-medium leading-relaxed text-slate-100">
            <span className="mr-2 text-slate-400">Q{currentIdx + 1}.</span>
            {currentQuestion.question_text}
          </div>

          {/* Answer input */}
          <div className="mb-6">
            <QuestionRenderer
              question={currentQuestion}
              localAnswer={localAnswer}
              disabled={status === "submitting"}
              onChange={(update) => updateAnswer(currentQuestion.id, update)}
            />
          </div>

          {/* Hint */}
          {currentQuestion.hint && (
            <details className="mb-4">
              <summary className="cursor-pointer text-xs text-yellow-400 hover:text-yellow-300">
                Show Hint
              </summary>
              <p className="mt-1 text-xs text-slate-400">{currentQuestion.hint}</p>
            </details>
          )}

          {/* Navigation buttons */}
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
            <button
              onClick={() => goTo(currentIdx - 1)}
              disabled={currentIdx === 0 || status === "submitting"}
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>

            <button
              onClick={skipQuestion}
              disabled={status === "submitting"}
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
            >
              Skip
            </button>

            <button
              onClick={() => goTo(currentIdx + 1)}
              disabled={currentIdx === questions.length - 1 || status === "submitting"}
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>

            {currentIdx === questions.length - 1 && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={status === "submitting"}
                className="ml-auto rounded-xl bg-yellow-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:opacity-50"
              >
                Finish Assessment
              </button>
            )}
          </div>
        </main>

        {/* ── Question Palette ── */}
        <aside className="flex w-64 flex-shrink-0 flex-col border-l border-slate-700 bg-slate-800 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Question Palette
          </p>

          {/* Legend */}
          <div className="mb-4 space-y-1.5 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded bg-emerald-500" />Answered ({answeredCount})
            </div>
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded bg-slate-400" />Skipped ({skippedCount})
            </div>
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded border border-slate-500 bg-slate-700" />
              Not Visited ({totalCount - answeredCount - skippedCount})
            </div>
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded bg-yellow-500" />Current
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((q, idx) => {
                const state = getQuestionState(q);
                const isCurrent = idx === currentIdx;
                return (
                  <button
                    key={q.id}
                    onClick={() => goTo(idx)}
                    aria-label={`Go to question ${idx + 1}`}
                    className={`flex h-9 w-full items-center justify-center rounded-lg text-xs font-semibold transition hover:opacity-80 ${paletteCls(state, isCurrent)}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary stats */}
          <div className="mt-4 border-t border-slate-700 pt-4">
            <div className="mb-2 flex justify-between text-xs text-slate-400">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-yellow-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </aside>

      </div>

      {/* ── Confirm dialog ── */}
      {showConfirm && (
        <ConfirmDialog
          answeredCount={answeredCount}
          skippedCount={skippedCount}
          totalCount={totalCount}
          onConfirm={handleConfirmSubmit}
          onCancel={() => setShowConfirm(false)}
        />
      )}

    </div>
  );
}
