import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { getCurrentQuizAdmin } from "../../services/quiz/quizAdminSession";
import { createQuiz, getQuiz, updateQuizMeta, saveQuestions, publishQuiz } from "../../services/quiz/quizService";
import type { QuizForm, QuestionForm } from "../../repositories/quiz/quizRepository";
import type { QuizDifficulty } from "../../types/quiz";

let localIdCounter = 0;
function nextLocalId() {
  localIdCounter += 1;
  return `local-${localIdCounter}`;
}

interface EditableQuestion extends QuestionForm {
  localId: string;
}

function blankQuestion(): EditableQuestion {
  return {
    localId: nextLocalId(),
    question_text: "",
    type: "mcq",
    timer_seconds: null,
    marks: 1,
    explanation: "",
    options: [
      { option_text: "", is_correct: true },
      { option_text: "", is_correct: false },
      { option_text: "", is_correct: false },
      { option_text: "", is_correct: false },
    ],
  };
}

const DEFAULT_FORM: QuizForm = {
  title: "",
  description: "",
  category_id: null,
  difficulty: "Medium",
  default_timer_seconds: 30,
  passing_score_pct: 60,
  improve_threshold_pct: 40,
  shuffle_options: false,
};

export default function QuizBuilderPage() {
  const admin = getCurrentQuizAdmin();
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  const isNew = !quizId;

  const [form, setForm] = useState<QuizForm>(DEFAULT_FORM);
  const [questions, setQuestions] = useState<EditableQuestion[]>([blankQuestion()]);
  const [savedQuizId, setSavedQuizId] = useState<string | null>(quizId ?? null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (isNew || !quizId) return;
    getQuiz(quizId)
      .then((quiz) => {
        if (!quiz) {
          setError("Quiz not found.");
          return;
        }
        setForm({
          title: quiz.title,
          description: quiz.description,
          category_id: quiz.category_id,
          difficulty: quiz.difficulty,
          default_timer_seconds: quiz.default_timer_seconds,
          passing_score_pct: quiz.passing_score_pct,
          improve_threshold_pct: quiz.improve_threshold_pct,
          shuffle_options: quiz.shuffle_options,
        });
        setQuestions(
          quiz.questions.length > 0
            ? quiz.questions.map((q) => ({
                localId: nextLocalId(),
                question_text: q.question_text,
                type: q.type,
                timer_seconds: q.timer_seconds,
                marks: q.marks,
                explanation: q.explanation,
                options: q.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
              }))
            : [blankQuestion()]
        );
      })
      .finally(() => setLoading(false));
  }, [quizId, isNew]);

  function updateQuestion(localId: string, patch: Partial<EditableQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.localId === localId ? { ...q, ...patch } : q)));
  }

  function updateOption(localId: string, optionIndex: number, text: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.localId === localId
          ? { ...q, options: q.options.map((o, i) => (i === optionIndex ? { ...o, option_text: text } : o)) }
          : q
      )
    );
  }

  function setCorrectOption(localId: string, optionIndex: number) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.localId === localId
          ? { ...q, options: q.options.map((o, i) => ({ ...o, is_correct: i === optionIndex })) }
          : q
      )
    );
  }

  function changeQuestionType(localId: string, type: EditableQuestion["type"]) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.localId === localId
          ? {
              ...q,
              type,
              options:
                type === "truefalse"
                  ? [
                      { option_text: "True", is_correct: true },
                      { option_text: "False", is_correct: false },
                    ]
                  : q.options.length >= 2
                  ? q.options
                  : blankQuestion().options,
            }
          : q
      )
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, blankQuestion()]);
  }

  function removeQuestion(localId: string) {
    setQuestions((prev) => (prev.length > 1 ? prev.filter((q) => q.localId !== localId) : prev));
  }

  async function persist(publish: boolean): Promise<string | null> {
    if (!admin) return null;
    setError("");
    setNotice("");
    setSaving(true);

    try {
      let id = savedQuizId;
      if (!id) {
        const created = await createQuiz(admin.company_id, admin.id, form);
        id = created.id;
        setSavedQuizId(id);
      } else {
        await updateQuizMeta(id, form);
      }

      const result = await saveQuestions(
        id,
        questions.map(({ localId: _localId, ...rest }) => rest)
      );
      if (!result.ok) {
        setError(result.error ?? "Could not save questions.");
        return null;
      }

      if (publish) {
        await publishQuiz(id);
        setNotice("Quiz published!");
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
    if (id && isNew) navigate(ROUTES.QUIZ_ADMIN_BUILDER_EDIT.replace(":quizId", id), { replace: true });
  }

  async function handlePublish() {
    const id = await persist(true);
    if (id && isNew) navigate(ROUTES.QUIZ_ADMIN_BUILDER_EDIT.replace(":quizId", id), { replace: true });
  }

  if (loading) return <div className="text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-8 pb-16">
      <h1 className="text-xl font-bold text-white">{isNew ? "Create New Quiz" : "Edit Quiz"}</h1>

      {error && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
      )}
      {notice && (
        <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
          {notice}
        </div>
      )}

      {/* Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Settings</h2>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Title *</label>
          <input
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. RERA Compliance Q3 2026"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Description</label>
          <textarea
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Difficulty</label>
            <select
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value as QuizDifficulty })}
            >
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Timer (s)</label>
            <input
              type="number"
              min={5}
              max={300}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={form.default_timer_seconds}
              onChange={(e) => setForm({ ...form, default_timer_seconds: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Pass %</label>
            <input
              type="number"
              min={1}
              max={100}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={form.passing_score_pct}
              onChange={(e) => setForm({ ...form, passing_score_pct: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Improve below %</label>
            <input
              type="number"
              min={1}
              max={100}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={form.improve_threshold_pct}
              onChange={(e) => setForm({ ...form, improve_threshold_pct: Number(e.target.value) })}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.shuffle_options}
            onChange={(e) => setForm({ ...form, shuffle_options: e.target.checked })}
          />
          Shuffle answer order for each player
        </label>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">{questions.length} question(s)</h2>
          <button
            onClick={addQuestion}
            className="text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-3 py-1.5"
          >
            + Add Question
          </button>
        </div>

        {questions.map((q, qi) => (
          <div key={q.localId} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-mono text-slate-500 bg-slate-800 rounded px-2 py-0.5">Q{qi + 1}</span>
              <div className="flex items-center gap-2">
                <select
                  className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white"
                  value={q.type}
                  onChange={(e) => changeQuestionType(q.localId, e.target.value as EditableQuestion["type"])}
                >
                  <option value="mcq">Multiple Choice</option>
                  <option value="truefalse">True / False</option>
                </select>
                <input
                  type="number"
                  min={5}
                  max={300}
                  placeholder="timer"
                  className="w-20 text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white"
                  value={q.timer_seconds ?? ""}
                  onChange={(e) =>
                    updateQuestion(q.localId, { timer_seconds: e.target.value ? Number(e.target.value) : null })
                  }
                />
                <button
                  onClick={() => removeQuestion(q.localId)}
                  className="text-xs text-red-300 hover:text-red-200 px-2"
                >
                  🗑
                </button>
              </div>
            </div>

            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              placeholder="Question text"
              value={q.question_text}
              onChange={(e) => updateQuestion(q.localId, { question_text: e.target.value })}
            />

            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <button
                    onClick={() => setCorrectOption(q.localId, oi)}
                    className={`h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center text-[10px] ${
                      opt.is_correct ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-600 text-transparent"
                    }`}
                    title="Mark as correct"
                  >
                    ✓
                  </button>
                  <input
                    className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-60"
                    value={opt.option_text}
                    disabled={q.type === "truefalse"}
                    onChange={(e) => updateOption(q.localId, oi, e.target.value)}
                    placeholder={`Option ${oi + 1}`}
                  />
                </div>
              ))}
            </div>

            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-violet-500"
              placeholder="Explanation (optional, shown after answering)"
              value={q.explanation}
              onChange={(e) => updateQuestion(q.localId, { explanation: e.target.value })}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-3 justify-end sticky bottom-4">
        <button
          disabled={saving}
          onClick={handleSaveDraft}
          className="text-sm font-semibold text-slate-200 border border-slate-700 bg-slate-900 rounded-lg px-4 py-2 disabled:opacity-50"
        >
          Save as Draft
        </button>
        <button
          disabled={saving}
          onClick={handlePublish}
          className="text-sm font-semibold bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-lg px-4 py-2 disabled:opacity-50"
        >
          🚀 Publish Quiz
        </button>
      </div>
    </div>
  );
}
