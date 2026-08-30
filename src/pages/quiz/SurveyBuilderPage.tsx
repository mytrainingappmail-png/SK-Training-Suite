import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import {
  createSurvey,
  updateSurveyMeta,
  getSurveyWithQuestions,
  replaceSurveyQuestions,
  setSurveyStatus,
} from "../../repositories/survey/surveyRepository";
import type { SurveyForm, SurveyQuestionForm } from "../../repositories/survey/surveyRepository";
import type { SurveyQuestionType, SurveySentiment } from "../../types/survey";

let localIdCounter = 0;
function nextLocalId() {
  localIdCounter += 1;
  return `local-${localIdCounter}`;
}

interface EditableSurveyQuestion extends SurveyQuestionForm {
  localId: string;
}

function blankQuestion(): EditableSurveyQuestion {
  return {
    localId: nextLocalId(),
    question_text: "",
    type: "single_choice",
    required: true,
    scale_min: 1,
    scale_max: 5,
    options: [
      { option_text: "", sentiment: "positive" },
      { option_text: "", sentiment: "negative" },
    ],
  };
}

const DEFAULT_FORM: SurveyForm = { title: "", description: "", closes_at: null };
const TYPE_LABELS: Record<SurveyQuestionType, string> = {
  single_choice: "Single Choice",
  multi_choice: "Multiple Choice",
  scale: "Rating Scale",
  open_text: "Open Text (free response)",
};
const SENTIMENT_LABELS: Record<SurveySentiment, string> = { positive: "🙂 Positive", neutral: "😐 Neutral", negative: "🙁 Negative" };
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

export default function SurveyBuilderPage() {
  const admin = getCurrentQuizAdmin();
  const navigate = useNavigate();
  const { surveyId } = useParams<{ surveyId: string }>();
  const isNew = !surveyId;
  const canEdit = canEditQuizContent();

  const [form, setForm] = useState<SurveyForm>(DEFAULT_FORM);
  const [questions, setQuestions] = useState<EditableSurveyQuestion[]>([blankQuestion()]);
  const [savedSurveyId, setSavedSurveyId] = useState<string | null>(surveyId ?? null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (isNew && !canEdit) navigate(ROUTES.QUIZ_ADMIN_SURVEYS, { replace: true });
  }, [isNew, canEdit, navigate]);

  useEffect(() => {
    if (isNew || !surveyId) return;
    getSurveyWithQuestions(surveyId)
      .then((survey) => {
        if (!survey) {
          setError("Survey not found.");
          return;
        }
        setForm({ title: survey.title, description: survey.description, closes_at: survey.closes_at });
        setQuestions(
          survey.questions.length > 0
            ? survey.questions.map((q) => ({
                localId: nextLocalId(),
                question_text: q.question_text,
                type: q.type,
                required: q.required,
                scale_min: q.scale_min ?? 1,
                scale_max: q.scale_max ?? 5,
                options: q.options.map((o) => ({ option_text: o.option_text, sentiment: o.sentiment })),
              }))
            : [blankQuestion()]
        );
      })
      .finally(() => setLoading(false));
  }, [surveyId, isNew]);

  function updateQuestion(localId: string, patch: Partial<EditableSurveyQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.localId === localId ? { ...q, ...patch } : q)));
  }

  function changeQuestionType(localId: string, type: SurveyQuestionType) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.localId !== localId) return q;
        const needsOptions = type === "single_choice" || type === "multi_choice";
        return {
          ...q,
          type,
          options: needsOptions && q.options.length >= MIN_OPTIONS ? q.options : [{ option_text: "", sentiment: "positive" as const }, { option_text: "", sentiment: "negative" as const }],
        };
      })
    );
  }

  function updateOption(localId: string, optionIndex: number, text: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.localId === localId ? { ...q, options: q.options.map((o, i) => (i === optionIndex ? { ...o, option_text: text } : o)) } : q))
    );
  }

  function updateOptionSentiment(localId: string, optionIndex: number, sentiment: SurveySentiment) {
    setQuestions((prev) =>
      prev.map((q) => (q.localId === localId ? { ...q, options: q.options.map((o, i) => (i === optionIndex ? { ...o, sentiment } : o)) } : q))
    );
  }

  function addOption(localId: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.localId === localId && q.options.length < MAX_OPTIONS ? { ...q, options: [...q.options, { option_text: "", sentiment: "neutral" as const }] } : q))
    );
  }

  function removeOption(localId: string, optionIndex: number) {
    setQuestions((prev) =>
      prev.map((q) => (q.localId === localId && q.options.length > MIN_OPTIONS ? { ...q, options: q.options.filter((_, i) => i !== optionIndex) } : q))
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, blankQuestion()]);
  }

  function removeQuestion(localId: string) {
    setQuestions((prev) => (prev.length > 1 ? prev.filter((q) => q.localId !== localId) : prev));
  }

  function validate(): string | null {
    if (!form.title.trim()) return "Survey title is required.";
    if (questions.length === 0) return "Add at least one question.";
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) return `Question ${i + 1} has no text.`;
      if ((q.type === "single_choice" || q.type === "multi_choice") && q.options.filter((o) => o.option_text.trim()).length < 2) {
        return `Question ${i + 1} needs at least 2 options.`;
      }
      if (q.type === "scale" && (q.scale_min == null || q.scale_max == null || q.scale_max <= q.scale_min)) {
        return `Question ${i + 1}'s scale range is invalid.`;
      }
    }
    return null;
  }

  async function persist(publish: boolean): Promise<string | null> {
    if (!admin) return null;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return null;
    }

    setError("");
    setNotice("");
    setSaving(true);
    try {
      let id = savedSurveyId;
      if (!id) {
        const created = await createSurvey(admin.company_id, admin.id, form);
        id = created.id;
        setSavedSurveyId(id);
      } else {
        await updateSurveyMeta(id, form);
      }

      await replaceSurveyQuestions(
        id,
        questions.map(({ localId: _localId, ...rest }) => rest)
      );

      if (publish) {
        await setSurveyStatus(id, "published");
        setNotice("Survey published!");
      } else {
        setNotice("Draft saved.");
      }
      return id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    const id = await persist(false);
    if (id && isNew) navigate(ROUTES.QUIZ_ADMIN_SURVEY_BUILDER_EDIT.replace(":surveyId", id), { replace: true });
  }

  async function handlePublish() {
    const id = await persist(true);
    if (id && isNew) navigate(ROUTES.QUIZ_ADMIN_SURVEY_BUILDER_EDIT.replace(":surveyId", id), { replace: true });
  }

  if (loading) return <div className="text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-8 pb-16">
      <h1 className="text-xl font-bold text-white">{isNew ? "Create New Survey" : "Edit Survey"}</h1>
      <p className="text-sm text-slate-400 -mt-6">No scoring, no right/wrong, nothing shown back to the respondent — just their answers, collected anonymously.</p>

      {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
      {notice && <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">{notice}</div>}

      <fieldset disabled={!canEdit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Survey Details</h2>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Title *</label>
          <input
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Q3 Employee Satisfaction Survey"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Description</label>
          <textarea
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Shown to the respondent before the questions"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Closes On (optional)</label>
          <input
            type="datetime-local"
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            value={form.closes_at ? form.closes_at.slice(0, 16) : ""}
            onChange={(e) => setForm({ ...form, closes_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
          />
          <p className="text-[11px] text-slate-500 mt-1">After this, the link stops accepting responses. Leave blank to keep it open indefinitely.</p>
        </div>
      </fieldset>

      <fieldset disabled={!canEdit} className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Questions</h2>
        {questions.map((q, qi) => (
          <div key={q.localId} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-mono text-slate-500 bg-slate-800 rounded px-2 py-0.5">Q{qi + 1}</span>
              <div className="flex items-center gap-2">
                <select
                  className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white"
                  value={q.type}
                  onChange={(e) => changeQuestionType(q.localId, e.target.value as SurveyQuestionType)}
                >
                  {(Object.keys(TYPE_LABELS) as SurveyQuestionType[]).map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs text-slate-300">
                  <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(q.localId, { required: e.target.checked })} />
                  Required
                </label>
                <button
                  onClick={() => removeQuestion(q.localId)}
                  disabled={questions.length <= 1}
                  className="text-xs text-red-300 hover:text-red-200 disabled:opacity-30 px-1"
                >
                  🗑
                </button>
              </div>
            </div>

            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={q.question_text}
              onChange={(e) => updateQuestion(q.localId, { question_text: e.target.value })}
              placeholder="e.g. Are you happy with the company?"
            />

            {(q.type === "single_choice" || q.type === "multi_choice") && (
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500"
                      value={opt.option_text}
                      onChange={(e) => updateOption(q.localId, oi, e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                    />
                    <select
                      className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-1.5 text-slate-200"
                      value={opt.sentiment}
                      onChange={(e) => updateOptionSentiment(q.localId, oi, e.target.value as SurveySentiment)}
                      title="Drives the overall positivity score"
                    >
                      {(Object.keys(SENTIMENT_LABELS) as SurveySentiment[]).map((s) => (
                        <option key={s} value={s}>{SENTIMENT_LABELS[s]}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeOption(q.localId, oi)}
                      disabled={q.options.length <= MIN_OPTIONS}
                      className="text-xs text-red-300 hover:text-red-200 disabled:opacity-30 px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addOption(q.localId)}
                  disabled={q.options.length >= MAX_OPTIONS}
                  className="text-xs font-semibold text-violet-300 hover:text-violet-200 disabled:opacity-30"
                >
                  + Add Option
                </button>
                <p className="text-[11px] text-slate-500">🙂/🙁 tag each option as Positive/Neutral/Negative so results can show one overall score.</p>
              </div>
            )}

            {q.type === "scale" && (
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-400">From</label>
                <input
                  type="number"
                  className="w-16 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white outline-none focus:border-violet-500"
                  value={q.scale_min ?? 1}
                  onChange={(e) => updateQuestion(q.localId, { scale_min: Number(e.target.value) })}
                />
                <label className="text-xs text-slate-400">To</label>
                <input
                  type="number"
                  className="w-16 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white outline-none focus:border-violet-500"
                  value={q.scale_max ?? 5}
                  onChange={(e) => updateQuestion(q.localId, { scale_max: Number(e.target.value) })}
                />
              </div>
            )}

            {q.type === "open_text" && <p className="text-xs text-slate-500 italic">Respondent will type a free-text answer here.</p>}
          </div>
        ))}

        {canEdit && (
          <button onClick={addQuestion} className="text-sm font-semibold text-violet-300 hover:text-violet-200 border border-dashed border-slate-700 rounded-xl px-4 py-2.5 w-full">
            + Add Question
          </button>
        )}
      </fieldset>

      {canEdit && (
        <div className="flex gap-3 sticky bottom-4 bg-slate-950/80 backdrop-blur border border-slate-800 rounded-2xl p-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="flex-1 text-sm font-semibold text-slate-200 border border-slate-700 hover:bg-slate-800 disabled:opacity-50 rounded-lg px-4 py-2.5"
          >
            💾 {saving ? "Saving…" : "Save Draft"}
          </button>
          <button
            onClick={handlePublish}
            disabled={saving}
            className="flex-1 text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg px-4 py-2.5"
          >
            🚀 {saving ? "Saving…" : "Publish"}
          </button>
        </div>
      )}
    </div>
  );
}
