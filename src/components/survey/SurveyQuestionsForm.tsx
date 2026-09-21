import { useEffect, useRef, useState } from "react";

import type { PublicSurveyQuestion, SurveyAnswerInput, SurveySettings } from "../../types/survey";

type AnswerState = Record<string, SurveyAnswerInput>;

/** Shared question-answering UI for both taking flows (anonymous link
 * and live-session join) — identical questions, identical rendering;
 * only what happens around this component (title/description, the
 * thank-you message, whether a name was collected) differs per page.
 *
 * If ANY question has its own time limit, the survey switches to a
 * one-question-at-a-time flow: each question shows its own countdown and
 * moves on by itself when it runs out (unanswered = skipped, even if it
 * was marked required — the timer is what the admin asked for). Questions
 * without a limit in the same survey simply wait for the respondent to tap
 * Next. With no per-question limits at all, everything shows on one page
 * exactly as before. */
export default function SurveyQuestionsForm({
  questions,
  settings,
  onSubmit,
  autoSubmitSignal,
}: {
  questions: PublicSurveyQuestion[];
  settings: Pick<SurveySettings, "option_font_size" | "option_colors">;
  onSubmit: (answers: SurveyAnswerInput[]) => Promise<void>;
  /** Bump this (e.g. a counter) to force-submit whatever's been answered so far, skipping the required-question check — used when a live session's timer hits zero so nobody gets stuck unable to submit. */
  autoSubmitSignal?: number;
}) {
  const [answers, setAnswers] = useState<AnswerState>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const stepped = questions.some((q) => q.time_limit_seconds !== null);
  const current = stepped ? questions[step] : null;
  const isLastStep = step >= questions.length - 1;
  // Latest values for the timer callback, which is created once per step.
  const advanceRef = useRef<() => void>(() => {});

  function setSingleChoice(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { question_id: questionId, selected_option_ids: [optionId] } }));
  }

  function toggleMultiChoice(questionId: string, optionId: string) {
    setAnswers((prev) => {
      const currentIds = prev[questionId]?.selected_option_ids ?? [];
      const next = currentIds.includes(optionId) ? currentIds.filter((id) => id !== optionId) : [...currentIds, optionId];
      return { ...prev, [questionId]: { question_id: questionId, selected_option_ids: next } };
    });
  }

  function setScale(questionId: string, value: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: { question_id: questionId, scale_value: value } }));
  }

  function setText(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { question_id: questionId, text_value: value } }));
  }

  function isAnswered(a: SurveyAnswerInput | undefined): boolean {
    if (!a) return false;
    if (a.selected_option_ids) return a.selected_option_ids.length > 0;
    if (a.scale_value !== undefined) return true;
    if (a.text_value !== undefined) return a.text_value.trim().length > 0;
    return false;
  }

  async function handleSubmit(isTimeout = false) {
    // A question with its own timer may legitimately be left unanswered
    // (its countdown ran out), so "required" only binds untimed questions
    // — and never once the whole session's clock has run out. The server
    // applies the same rule.
    const missing = isTimeout ? undefined : questions.find((q) => q.required && q.time_limit_seconds === null && !isAnswered(answers[q.question_id]));
    if (missing) {
      setError(`Please answer: "${missing.question_text}"`);
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await onSubmit(Object.values(answers));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit your response.");
    } finally {
      setSubmitting(false);
    }
  }

  function goNext(fromTimer: boolean) {
    if (!current) return;
    if (!fromTimer && current.required && current.time_limit_seconds === null && !isAnswered(answers[current.question_id])) {
      setError(`Please answer: "${current.question_text}"`);
      return;
    }
    setError("");
    if (isLastStep) {
      void handleSubmit(fromTimer);
    } else {
      setStep((s) => s + 1);
    }
  }
  advanceRef.current = () => goNext(true);

  // One countdown per timed step; restarts whenever the step changes.
  useEffect(() => {
    if (!current || current.time_limit_seconds === null) {
      setSecondsLeft(null);
      return;
    }
    const deadline = Date.now() + current.time_limit_seconds * 1000;
    setSecondsLeft(current.time_limit_seconds);
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(t);
        advanceRef.current();
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, stepped]);

  useEffect(() => {
    if (autoSubmitSignal) handleSubmit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmitSignal]);

  function renderQuestion(q: PublicSurveyQuestion, label: number) {
    return (
      <div key={q.question_id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <p className="text-sm font-semibold text-white mb-3">
          {label}. {q.question_text} {q.required && q.time_limit_seconds === null && <span className="text-red-400">*</span>}
        </p>

        {q.type === "single_choice" && (
          <div className="space-y-2">
            {q.options.map((opt, oi) => {
              const color = settings.option_colors[oi % settings.option_colors.length];
              const selected = answers[q.question_id]?.selected_option_ids?.[0] === opt.option_id;
              return (
                <button
                  key={opt.option_id}
                  type="button"
                  onClick={() => setSingleChoice(q.question_id, opt.option_id)}
                  className="w-full text-left rounded-xl px-4 py-2.5 font-semibold transition-all border-2"
                  style={{
                    backgroundColor: selected ? color.box : `${color.box}22`,
                    color: selected ? color.font : color.box,
                    borderColor: color.box,
                    fontSize: settings.option_font_size,
                  }}
                >
                  {selected ? "● " : "○ "}{opt.option_text}
                </button>
              );
            })}
          </div>
        )}

        {q.type === "multi_choice" && (
          <div className="space-y-2">
            {q.options.map((opt, oi) => {
              const color = settings.option_colors[oi % settings.option_colors.length];
              const selected = (answers[q.question_id]?.selected_option_ids ?? []).includes(opt.option_id);
              return (
                <button
                  key={opt.option_id}
                  type="button"
                  onClick={() => toggleMultiChoice(q.question_id, opt.option_id)}
                  className="w-full text-left rounded-xl px-4 py-2.5 font-semibold transition-all border-2"
                  style={{
                    backgroundColor: selected ? color.box : `${color.box}22`,
                    color: selected ? color.font : color.box,
                    borderColor: color.box,
                    fontSize: settings.option_font_size,
                  }}
                >
                  {selected ? "☑ " : "☐ "}{opt.option_text}
                </button>
              );
            })}
          </div>
        )}

        {q.type === "scale" && (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: (q.scale_max ?? 5) - (q.scale_min ?? 1) + 1 }, (_, i) => (q.scale_min ?? 1) + i).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setScale(q.question_id, v)}
                className={`h-10 w-10 rounded-lg text-sm font-semibold border-2 ${
                  answers[q.question_id]?.scale_value === v
                    ? "border-violet-500 bg-violet-500/20 text-violet-200"
                    : "border-slate-700 text-slate-300 hover:border-slate-600"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}

        {q.type === "open_text" && (
          <textarea
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            rows={3}
            value={answers[q.question_id]?.text_value ?? ""}
            onChange={(e) => setText(q.question_id, e.target.value)}
            placeholder="Type your answer…"
          />
        )}
      </div>
    );
  }

  if (stepped && current) {
    const urgent = secondsLeft !== null && secondsLeft <= 5;
    return (
      <div className="space-y-4">
        {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Question {step + 1} of {questions.length}</span>
          {secondsLeft !== null && (
            <span className={`rounded-full px-3 py-1 font-mono font-bold ${urgent ? "bg-red-500/20 text-red-300 animate-pulse" : "bg-slate-800 text-slate-200"}`}>
              ⏱ {secondsLeft}s
            </span>
          )}
        </div>

        {renderQuestion(current, step + 1)}

        <button
          onClick={() => goNext(false)}
          disabled={submitting}
          className="w-full text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg px-4 py-3"
        >
          {submitting ? "Submitting…" : isLastStep ? "Submit" : "Next →"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

      <div className="space-y-4">{questions.map((q, qi) => renderQuestion(q, qi + 1))}</div>

      <button
        onClick={() => handleSubmit()}
        disabled={submitting}
        className="w-full text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg px-4 py-3"
      >
        {submitting ? "Submitting…" : "Submit"}
      </button>
    </div>
  );
}
