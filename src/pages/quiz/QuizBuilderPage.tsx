import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { createQuiz, getQuiz, updateQuizMeta, saveQuestions, publishQuiz } from "../../services/quiz/quizService";
import { buildSampleCsv, parseCsv, csvRowsToQuestions, downloadCsvFile } from "../../services/quiz/quizCsvService";
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
    is_hidden: false,
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
  shuffle_questions: false,
  issue_certificate: true,
};

export default function QuizBuilderPage() {
  const admin = getCurrentQuizAdmin();
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  const isNew = !quizId;
  const canEdit = canEditQuizContent();

  const [form, setForm] = useState<QuizForm>(DEFAULT_FORM);
  const [questions, setQuestions] = useState<EditableQuestion[]>([blankQuestion()]);
  const [savedQuizId, setSavedQuizId] = useState<string | null>(quizId ?? null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvImportedCount, setCsvImportedCount] = useState<number | null>(null);

  useEffect(() => {
    if (isNew && !canEdit) navigate(ROUTES.QUIZ_ADMIN_QUIZZES, { replace: true });
  }, [isNew, canEdit, navigate]);

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
          shuffle_questions: quiz.shuffle_questions,
          issue_certificate: quiz.issue_certificate,
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
                is_hidden: q.is_hidden,
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

  function duplicateQuestion(localId: string) {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.localId === localId);
      if (index === -1) return prev;
      const copy: EditableQuestion = {
        ...prev[index],
        localId: nextLocalId(),
        options: prev[index].options.map((o) => ({ ...o })),
      };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  }

  const MIN_OPTIONS = 2;
  const MAX_OPTIONS = 6;

  function addOption(localId: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.localId === localId && q.type !== "truefalse" && q.options.length < MAX_OPTIONS
          ? { ...q, options: [...q.options, { option_text: "", is_correct: false }] }
          : q
      )
    );
  }

  function removeOption(localId: string, optionIndex: number) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.localId !== localId || q.type === "truefalse" || q.options.length <= MIN_OPTIONS) return q;
        const removingCorrect = q.options[optionIndex]?.is_correct;
        const nextOptions = q.options.filter((_, i) => i !== optionIndex);
        if (removingCorrect && !nextOptions.some((o) => o.is_correct) && nextOptions.length > 0) {
          nextOptions[0] = { ...nextOptions[0], is_correct: true };
        }
        return { ...q, options: nextOptions };
      })
    );
  }

  function resetQuestionTimer(localId: string) {
    updateQuestion(localId, { timer_seconds: null });
  }

  function toggleHidden(localId: string) {
    setQuestions((prev) => prev.map((q) => (q.localId === localId ? { ...q, is_hidden: !q.is_hidden } : q)));
  }

  function isBlankQuestion(q: EditableQuestion): boolean {
    return !q.question_text.trim() && q.options.every((o) => !o.option_text.trim());
  }

  function handleDownloadSampleCsv() {
    downloadCsvFile("live-quiz-sample.csv", buildSampleCsv());
  }

  function handleCsvFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = parseCsv(text);
      const { questions: imported, errors } = csvRowsToQuestions(rows);

      setCsvErrors(errors);
      setCsvImportedCount(imported.length);
      if (imported.length === 0) return;

      const newQuestions: EditableQuestion[] = imported.map((q) => ({ ...q, localId: nextLocalId() }));
      setQuestions((prev) => {
        const keep = prev.filter((q) => !isBlankQuestion(q));
        return [...keep, ...newQuestions];
      });
    };
    reader.readAsText(file);
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
      <fieldset disabled={!canEdit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
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
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.shuffle_questions}
            onChange={(e) => setForm({ ...form, shuffle_questions: e.target.checked })}
          />
          Shuffle question order for each session
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.issue_certificate}
            onChange={(e) => setForm({ ...form, issue_certificate: e.target.checked })}
          />
          🏆 Issue certificate for passing this quiz
        </label>
        {!form.issue_certificate && (
          <p className="text-xs text-slate-500 -mt-2">No certificate will be offered for this quiz, regardless of score — useful for practice/ungraded quizzes.</p>
        )}
      </fieldset>

      {/* Bulk import */}
      {canEdit && (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">📄 Bulk Import Questions (CSV)</h2>
        <p className="text-xs text-slate-500">
          Download the sample to see the exact format, fill it in with your own questions, then upload it here —
          it's added straight into this quiz below.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadSampleCsv}
            className="text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-3 py-1.5"
          >
            ⬇ Download Sample CSV
          </button>
          <label className="text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-lg px-3 py-1.5 cursor-pointer">
            ⬆ Import from CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFileSelected} />
          </label>
        </div>
        {csvImportedCount !== null && (
          <div className="text-sm text-emerald-300">
            ✅ Imported {csvImportedCount} question{csvImportedCount === 1 ? "" : "s"}.
          </div>
        )}
        {csvErrors.length > 0 && (
          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 space-y-1">
            <div className="font-semibold">{csvErrors.length} row(s) skipped:</div>
            {csvErrors.map((e, i) => (
              <div key={i}>• {e}</div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Questions */}
      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">{questions.length} question(s)</h2>
          {canEdit && (
          <button
            onClick={addQuestion}
            className="text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-3 py-1.5"
          >
            + Add Question
          </button>
          )}
        </div>

        {questions.map((q, qi) => (
          <div key={q.localId} className={`bg-slate-900 border rounded-2xl p-5 space-y-3 ${q.is_hidden ? "border-amber-700/50 opacity-60" : "border-slate-800"}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500 bg-slate-800 rounded px-2 py-0.5">Q{qi + 1}</span>
                <button
                  onClick={() => toggleHidden(q.localId)}
                  title={q.is_hidden ? "Hidden — not asked live, doesn't count toward results. Click to unhide." : "Click to hide this question from play"}
                  className={`text-xs font-semibold rounded-lg px-2 py-1 border ${
                    q.is_hidden ? "border-amber-600 bg-amber-500/10 text-amber-300" : "border-slate-700 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {q.is_hidden ? "🙈 Hidden" : "👁 Visible"}
                </button>
              </div>
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
                  title={q.timer_seconds === null ? "Following the default timer above" : "Manually overridden for this question"}
                  className={`w-20 text-xs bg-slate-800 border rounded-lg px-2 py-1 text-white ${
                    q.timer_seconds === null ? "border-slate-700 text-slate-400" : "border-violet-500"
                  }`}
                  value={q.timer_seconds ?? form.default_timer_seconds}
                  onChange={(e) =>
                    updateQuestion(q.localId, { timer_seconds: e.target.value ? Number(e.target.value) : null })
                  }
                />
                {q.timer_seconds !== null && (
                  <button
                    onClick={() => resetQuestionTimer(q.localId)}
                    title="Reset to the default timer above"
                    className="text-xs text-violet-300 hover:text-violet-200 px-1"
                  >
                    ↺
                  </button>
                )}
                <button
                  onClick={() => duplicateQuestion(q.localId)}
                  title="Duplicate this question"
                  className="text-xs text-slate-300 hover:text-white px-2"
                >
                  ⧉
                </button>
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
                  {q.type !== "truefalse" && q.options.length > MIN_OPTIONS && (
                    <button
                      onClick={() => removeOption(q.localId, oi)}
                      title="Remove this option"
                      className="text-xs text-red-300 hover:text-red-200 px-1 shrink-0"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {q.type !== "truefalse" && q.options.length < MAX_OPTIONS && (
                <button
                  onClick={() => addOption(q.localId)}
                  className="text-xs font-semibold text-violet-300 hover:text-violet-200 px-1"
                >
                  + Add Option
                </button>
              )}
            </div>

            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-violet-500"
              placeholder="Explanation (optional, shown after answering)"
              value={q.explanation}
              onChange={(e) => updateQuestion(q.localId, { explanation: e.target.value })}
            />
          </div>
        ))}
      </fieldset>

      {canEdit ? (
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
      ) : (
        <div className="text-xs text-slate-500 text-right">👁 View only — you don't have permission to edit quizzes.</div>
      )}
    </div>
  );
}
