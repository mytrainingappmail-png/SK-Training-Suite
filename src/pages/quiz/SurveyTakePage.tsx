import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getSurveyByCode, submitSurveyResponse } from "../../repositories/survey/surveyPublicRepository";
import type { PublicSurvey, SurveyAnswerInput } from "../../types/survey";

type AnswerState = Record<string, SurveyAnswerInput>;

export default function SurveyTakePage() {
  const { accessCode } = useParams<{ accessCode: string }>();
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessCode) return;
    getSurveyByCode(accessCode)
      .then((s) => {
        if (!s) {
          setError("This survey link isn't available — it may have been closed.");
          return;
        }
        setSurvey(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load this survey."))
      .finally(() => setLoading(false));
  }, [accessCode]);

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
    if (!survey || !accessCode) return;
    const missing = survey.questions.find((q) => q.required && !isAnswered(answers[q.question_id]));
    if (missing) {
      setError(`Please answer: "${missing.question_text}"`);
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await submitSurveyResponse(accessCode, Object.values(answers));
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit your response.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-500 text-sm">Loading…</div>;

  if (error && !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-sm text-center text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4">{error}</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-sm text-center bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-lg font-bold text-white mb-1">Thank you</h1>
          <p className="text-sm text-slate-400">Your response has been submitted anonymously.</p>
        </div>
      </div>
    );
  }

  if (!survey) return null;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">{survey.title}</h1>
          {survey.description && <p className="text-sm text-slate-400 mt-1">{survey.description}</p>}
          <p className="text-[11px] text-slate-500 mt-2">🔒 Fully anonymous — your identity is never collected or stored.</p>
        </div>

        {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-4">
          {survey.questions.map((q, qi) => (
            <div key={q.question_id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-sm font-semibold text-white mb-3">
                {qi + 1}. {q.question_text} {q.required && <span className="text-red-400">*</span>}
              </p>

              {q.type === "single_choice" && (
                <div className="space-y-2">
                  {q.options.map((opt) => (
                    <label key={opt.option_id} className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name={q.question_id}
                        checked={answers[q.question_id]?.selected_option_ids?.[0] === opt.option_id}
                        onChange={() => setSingleChoice(q.question_id, opt.option_id)}
                      />
                      {opt.option_text}
                    </label>
                  ))}
                </div>
              )}

              {q.type === "multi_choice" && (
                <div className="space-y-2">
                  {q.options.map((opt) => (
                    <label key={opt.option_id} className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(answers[q.question_id]?.selected_option_ids ?? []).includes(opt.option_id)}
                        onChange={() => toggleMultiChoice(q.question_id, opt.option_id)}
                      />
                      {opt.option_text}
                    </label>
                  ))}
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
    </div>
  );
}
