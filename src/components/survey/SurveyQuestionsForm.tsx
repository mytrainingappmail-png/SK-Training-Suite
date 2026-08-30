import { useState } from "react";

import type { PublicSurveyQuestion, SurveyAnswerInput, SurveySettings } from "../../types/survey";

type AnswerState = Record<string, SurveyAnswerInput>;

/** Shared question-answering UI for both taking flows (anonymous link
 * and live-session join) — identical questions, identical rendering;
 * only what happens around this component (title/description, the
 * thank-you message, whether a name was collected) differs per page. */
export default function SurveyQuestionsForm({
  questions,
  settings,
  onSubmit,
}: {
  questions: PublicSurveyQuestion[];
  settings: Pick<SurveySettings, "option_font_size" | "option_colors">;
  onSubmit: (answers: SurveyAnswerInput[]) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<AnswerState>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function setSingleChoice(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { question_id: questionId, selected_option_ids: [optionId] } }));
  }

  function toggleMultiChoice(questionId: string, optionId: string) {
    setAnswers((prev) => {
      const current = prev[questionId]?.selected_option_ids ?? [];
      const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
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

  async function handleSubmit() {
    const missing = questions.find((q) => q.required && !isAnswered(answers[q.question_id]));
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

  return (
    <div className="space-y-6">
      {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div key={q.question_id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-sm font-semibold text-white mb-3">
              {qi + 1}. {q.question_text} {q.required && <span className="text-red-400">*</span>}
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
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg px-4 py-3"
      >
        {submitting ? "Submitting…" : "Submit"}
      </button>
    </div>
  );
}
