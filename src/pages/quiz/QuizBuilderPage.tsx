import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { createQuiz, getQuiz, updateQuizMeta, saveQuestions, publishQuiz, resyncQuestionFromSource } from "../../services/quiz/quizService";
import { buildSampleCsv, parseCsv, csvRowsToQuestions, downloadCsvFile } from "../../services/quiz/quizCsvService";
import HotspotZoneEditor from "../../components/quiz/HotspotZoneEditor";
import HotspotBulkMarker from "../../components/quiz/HotspotBulkMarker";
import { effectiveZones, legacyFromZones } from "../../components/quiz/hotspotZones";
import { describePlayMode } from "../../utils/quizPlayMode";
import { useQuizLocation } from "../../services/quiz/quizLocationStore";
import QuizDownloadMenu from "../../components/quiz/QuizDownloadMenu";
import type { ExportQuiz } from "../../services/quiz/quizExportService";
import type { HotspotZone } from "../../types/quiz";
import type { QuizForm, QuestionForm } from "../../repositories/quiz/quizRepository";
import { hindiOf, listTopics, optionWithHindi, originOf, topicOf } from "../../repositories/quiz/quizRepository";
import QuizBrandingImageField from "../../components/quiz/QuizBrandingImageField";
import QuestionHindiPanel from "../../components/quiz/QuestionHindiPanel";
import QuestionTransferModal, { type TransferRequest, type TransferOutcome } from "../../components/quiz/QuestionTransferModal";
import SyncChoiceModal, { type SyncItem } from "../../components/quiz/SyncChoiceModal";
import DeleteChoiceModal from "../../components/quiz/DeleteChoiceModal";
import { getQuestionLinks, syncQuestionCopies, questionContentKey, questionForOtherTest, copyQuestionsToTest, createTestFromQuestions, deleteQuestionCopies, type QuestionLink } from "../../services/quiz/quizLinkService";
import { hasHindi, translateQuestionsToHindi } from "../../services/quiz/quizHindiService";
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
    source_label: null,
    source_question_id: null,
    options: [
      { option_text: "", is_correct: true },
      { option_text: "", is_correct: false },
      { option_text: "", is_correct: false },
      { option_text: "", is_correct: false },
    ],
    image_url: null,
    target_x: null,
    target_y: null,
    target_radius: null,
    hotspot_zones: null,
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
  shuffle_questions_per_participant: false,
  issue_certificate: true,
  mode: "live",
  exam_duration_minutes: null,
  reveal_answers: null,
  allow_early_next: null,
  bg_kind: null,
  bg_image_url: null,
  location_id: undefined, // new quiz: follows the location switch at the top until chosen here
};

// An exam starts with the anti-cheat shuffles ON (each person's question and
// option order differs) and a one-hour paper — all editable.
const DEFAULT_EXAM_FORM: QuizForm = {
  ...DEFAULT_FORM,
  difficulty: "Medium",
  passing_score_pct: 60,
  shuffle_options: true,
  shuffle_questions_per_participant: true,
  mode: "exam",
  exam_duration_minutes: 60,
};

export default function QuizBuilderPage({ mode = "live" }: { mode?: "live" | "exam" } = {}) {
  const isExam = mode === "exam";
  const listRoute = isExam ? ROUTES.QUIZ_ADMIN_EXAMS : ROUTES.QUIZ_ADMIN_QUIZZES;
  const editRoute = isExam ? ROUTES.QUIZ_ADMIN_EXAM_EDIT : ROUTES.QUIZ_ADMIN_BUILDER_EDIT;
  const admin = getCurrentQuizAdmin();
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  const isNew = !quizId;
  const canEdit = canEditQuizContent();

  const [form, setForm] = useState<QuizForm>(isExam ? DEFAULT_EXAM_FORM : DEFAULT_FORM);
  const { locations: allLocations, selectedId: selectedLocationId } = useQuizLocation();
  const [questions, setQuestions] = useState<EditableQuestion[]>([blankQuestion()]);
  const [savedQuizId, setSavedQuizId] = useState<string | null>(quizId ?? null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [resyncingId, setResyncingId] = useState<string | null>(null);
  const [resyncError, setResyncError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvImportedCount, setCsvImportedCount] = useState<number | null>(null);
  const [hindiBusy, setHindiBusy] = useState(false);
  const [hindiMessage, setHindiMessage] = useState("");
  const [removeSourceChoice, setRemoveSourceChoice] = useState("");
  const [bulkMarkImage, setBulkMarkImage] = useState<string | null>(null);

  // questions ticked for "new test / copy / move", where each question is also used, and what each looked like when it was loaded or last saved
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // topics this company already uses (suggestions while typing) and the one being typed for the ticked questions
  const [topicChoices, setTopicChoices] = useState<string[]>([]);
  const [bulkTopic, setBulkTopic] = useState("");
  useEffect(() => { void listTopics().then(setTopicChoices); }, []);
  const [transferOpen, setTransferOpen] = useState(false);
  const [links, setLinks] = useState<Map<string, QuestionLink[]>>(new Map());
  const baseline = useRef<Map<string, string>>(new Map());
  const [syncAsk, setSyncAsk] = useState<SyncItem[] | null>(null);
  const syncResolver = useRef<((uids: string[] | null) => void) | null>(null);
  // a question that is also in other tests was deleted here: which one is being asked about, and which were chosen to go from every test
  const [deleteAsk, setDeleteAsk] = useState<{ localId: string; label: string; links: QuestionLink[] } | null>(null);
  const deleteEverywhere = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isNew && !canEdit) navigate(listRoute, { replace: true });
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
          code: quiz.code,
          title: quiz.title,
          description: quiz.description,
          category_id: quiz.category_id,
          difficulty: quiz.difficulty,
          default_timer_seconds: quiz.default_timer_seconds,
          passing_score_pct: quiz.passing_score_pct,
          improve_threshold_pct: quiz.improve_threshold_pct,
          shuffle_options: quiz.shuffle_options,
          shuffle_questions: quiz.shuffle_questions,
          shuffle_questions_per_participant: quiz.shuffle_questions_per_participant,
          issue_certificate: quiz.issue_certificate,
          mode: quiz.mode,
          exam_duration_minutes: quiz.exam_duration_minutes,
          reveal_answers: quiz.reveal_answers ?? null,
          allow_early_next: quiz.allow_early_next ?? null,
          bg_kind: quiz.bg_kind ?? null,
          bg_image_url: quiz.bg_image_url ?? null,
          location_id: quiz.location_id ?? null,
        });
        const loadedQuestions: EditableQuestion[] =
          quiz.questions.length > 0
            ? quiz.questions.map((q) => ({
                localId: nextLocalId(),
                question_text: q.question_text,
                type: q.type,
                timer_seconds: q.timer_seconds,
                marks: q.marks,
                explanation: q.explanation,
                is_hidden: q.is_hidden,
                source_label: q.source_label,
                source_question_id: q.source_question_id,
                ...originOf(q),
                ...hindiOf(q),
                ...topicOf(q),
                options: q.options.map(optionWithHindi),
                image_url: q.image_url,
                target_x: q.target_x,
                target_y: q.target_y,
                target_radius: q.target_radius,
                hotspot_zones: q.hotspot_zones,
              }))
            : [blankQuestion()];
        setQuestions(loadedQuestions);
        void refreshLinks(loadedQuestions, quiz.id);
      })
      .finally(() => setLoading(false));
  }, [quizId, isNew]);

  /** Remembers what each shared question looks like now (to tell later what was edited) and where else each one is used. */
  async function refreshLinks(list: EditableQuestion[], forQuizId: string, resetBaseline = true) {
    const next = new Map<string, string>();
    for (const q of list) if (q.origin_uid) next.set(q.origin_uid, questionContentKey(q));
    if (resetBaseline) baseline.current = next;
    const uids = [...next.keys()];
    if (uids.length === 0) { setLinks(new Map()); return; }
    try {
      const rows = await getQuestionLinks(uids, forQuizId);
      const grouped = new Map<string, QuestionLink[]>();
      for (const r of rows) grouped.set(r.origin_uid, [...(grouped.get(r.origin_uid) ?? []), r]);
      setLinks(grouped);
    } catch {
      setLinks(new Map()); // the chips are a convenience - saving still works
    }
  }

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
                type === "hotspot" || type === "written"
                  ? []
                  : type === "truefalse"
                  ? [
                      { option_text: "True", is_correct: true },
                      { option_text: "False", is_correct: false },
                    ]
                  : q.options.length >= 2
                  ? q.options
                  : blankQuestion().options,
              // Switching away from hotspot: the image/target were only
              // ever meaningful for that type, so drop them rather than
              // silently carrying stale data on a now-different question.
              ...(type !== "hotspot" && q.type === "hotspot"
                ? { image_url: null, target_x: null, target_y: null, target_radius: null, hotspot_zones: null }
                : {}),
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

  /** The 🗑 button: always ask first, naming the question so the wrong one is not removed by a slip of the finger. */
  function handleRemoveQuestionClick(localId: string) {
    const index = questions.findIndex((q) => q.localId === localId);
    if (index === -1) return;
    if (questions.length <= 1) {
      alert("A quiz needs at least one question, so the last one cannot be deleted.");
      return;
    }
    const text = questions[index].question_text.trim().replace(/\s+/g, " ");
    const label = text ? `"${text.length > 70 ? text.slice(0, 70) + "…" : text}"` : "this empty question";
    // also used in other tests: ask whether it goes from them too
    const uid = questions[index].origin_uid;
    const where = uid ? links.get(uid) ?? [] : [];
    if (where.length > 0) {
      setDeleteAsk({ localId, label: `Q${index + 1} - ${label}`, links: where });
      return;
    }
    if (!confirm(`Delete question ${index + 1}: ${label}?

It is removed from this screen only - nothing is permanent until you click Save / Publish.`)) return;
    removeQuestion(localId);
  }

  /** Bulk-remove every question tagged with this source (see mergeQuizzes)
   * — e.g. a merged-in project that turned out not to be needed. Falls
   * back to a single blank question rather than leaving the list empty,
   * matching removeQuestion's own floor of at least one question. */
  function removeQuestionsFromSource(sourceLabel: string) {
    setQuestions((prev) => {
      const remaining = prev.filter((q) => q.source_label !== sourceLabel);
      return remaining.length > 0 ? remaining : [blankQuestion()];
    });
  }

  function handleRemoveSourceClick() {
    if (!removeSourceChoice) return;
    const count = sourceLabelCounts.get(removeSourceChoice) ?? 0;
    if (!confirm(`Remove ${count} question(s) from "${removeSourceChoice}"? The rest of this quiz stays as-is. Click Save/Publish afterwards to make it permanent.`)) return;
    removeQuestionsFromSource(removeSourceChoice);
    setRemoveSourceChoice("");
  }

  function duplicateQuestion(localId: string) {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.localId === localId);
      if (index === -1) return prev;
      const copy: EditableQuestion = {
        ...prev[index],
        localId: nextLocalId(),
        // a duplicate is a new question of its own (not another copy of the shared one)
        origin_uid: null,
        home_quiz_id: null,
        options: prev[index].options.map((o) => ({ ...o })),
      };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  }

  /** One map question that has several marked spots -> one question per spot (same map, ONE spot each).
   * Marks are shared out equally, each new question reads "Tap: <spot name>", and a tap inside that spot
   * counts as correct. Nothing is saved until Save/Publish. */
  function splitHotspotQuestion(localId: string) {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.localId === localId);
      if (index === -1) return prev;
      const src = prev[index];
      const zones = effectiveZones(src);
      if (src.type !== "hotspot" || zones.length < 2) return prev;
      const each = Math.max(1, Math.round((src.marks || zones.length) / zones.length));
      const copies: EditableQuestion[] = zones.map((z, i) => ({
        ...src,
        localId: nextLocalId(),
        origin_uid: null,
        home_quiz_id: null,
        question_text: `Tap: ${z.label?.trim() || `Spot ${i + 1}`}`,
        marks: each,
        options: src.options.map((o) => ({ ...o })),
        hotspot_zones: [z],
        ...legacyFromZones([z]),
      }));
      return [...prev.slice(0, index), ...copies, ...prev.slice(index + 1)];
    });
  }

  /** Pulls the CURRENT content of a merged question's original into this local copy — same edit-then-Save flow as any other change, so nothing is written until Save/Publish is clicked afterward. */
  async function handleResync(localId: string, sourceQuestionId: string | null, originUid?: string | null, homeQuizId?: string | null) {
    setResyncingId(localId);
    setResyncError("");
    try {
      const content = await resyncQuestionFromSource(sourceQuestionId, originUid, homeQuizId);
      if (!content) {
        setResyncError("The original question no longer exists — it may have been deleted.");
        return;
      }
      updateQuestion(localId, content);
    } catch (e) {
      setResyncError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setResyncingId(null);
    }
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

  // Hidden questions don't count toward results (see the 🙈 toggle above), so
  // the preview total excludes them too — otherwise it wouldn't match what
  // the Host screen / final score actually add up to.
  const totalMarks = questions.reduce((sum, q) => sum + (q.is_hidden ? 0 : q.marks || 1), 0);
  // A hidden question doesn't exist as far as play and results go, so the count and the Q-numbers skip it
  // until it is unhidden.
  const activeQuestionCount = questions.filter((q) => !q.is_hidden).length;
  const hiddenQuestionCount = questions.length - activeQuestionCount;
  const questionNumber = (() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const q of questions) if (!q.is_hidden) m.set(q.localId, ++n);
    return m;
  })();

  // Distinct source projects present among the current questions — only
  // non-empty for a merged quiz (see mergeQuizzes). Counts included so
  // "remove all of X" shows exactly how many that'll take with it.
  const sourceLabelCounts = questions.reduce((map, q) => {
    if (q.source_label) map.set(q.source_label, (map.get(q.source_label) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  // Map questions sharing the exact same image — candidates for the one-screen
  // "mark them all" tool (only worth offering when there are at least two).
  const bulkGroups = (() => {
    const byImage = new Map<string, { localId: string; label: string; zones: HotspotZone[] }[]>();
    for (const q of questions) {
      if (q.type !== "hotspot" || !q.image_url) continue;
      const list = byImage.get(q.image_url) ?? [];
      list.push({ localId: q.localId, label: q.question_text, zones: effectiveZones(q) });
      byImage.set(q.image_url, list);
    }
    return [...byImage.entries()].filter(([, items]) => items.length >= 2).map(([imageUrl, items]) => ({ imageUrl, items }));
  })();

  function handleBulkZonesChange(localId: string, zones: HotspotZone[]) {
    updateQuestion(localId, { hotspot_zones: zones.length > 0 ? zones : null, ...legacyFromZones(zones) });
  }

  /** The test as it is on the screen right now (saved or not), in the shape the PDF / CSV download needs. */
  function buildExportQuiz(): ExportQuiz {
    return {
      title: form.title.trim() || (isExam ? "Exam" : "Quiz"),
      description: form.description,
      mode: form.mode,
      difficulty: form.difficulty,
      default_timer_seconds: form.default_timer_seconds,
      passing_score_pct: form.passing_score_pct,
      exam_duration_minutes: form.exam_duration_minutes,
      questions: questions
        .filter((q) => q.question_text.trim() !== "")
        .map((q) => ({
          question_text: q.question_text,
          type: q.type,
          timer_seconds: q.timer_seconds,
          marks: q.marks,
          explanation: q.explanation,
          ...hindiOf(q),
          ...topicOf(q),
          is_hidden: q.is_hidden,
          options: q.options.map(optionWithHindi),
          image_url: q.image_url,
          hotspot_zones: q.hotspot_zones,
          target_x: q.target_x,
          target_y: q.target_y,
          target_radius: q.target_radius,
        })),
    };
  }

  /** Takes the Hindi version off every question (they go back to "not added"); nothing is saved until Save. */
  function handleRemoveAllHindi() {
    const withHindi = questions.filter(hasHindi).length;
    if (withHindi === 0) { setHindiMessage("No question has a Hindi version."); return; }
    if (!confirm(`Remove the Hindi version from ${withHindi} question${withHindi === 1 ? "" : "s"}? The English questions stay as they are. (Takes effect when you press Save.)`)) return;
    setQuestions((prev) => prev.map((q) => ({
      ...q,
      question_text_hi: "",
      explanation_hi: "",
      options: q.options.map((o) => ({ ...o, option_text_hi: null })),
    })));
    setHindiMessage(`Hindi removed from ${withHindi} question${withHindi === 1 ? "" : "s"}. Press Save to keep this.`);
  }

  /** Writes a first Hindi draft for every question that has none yet - or, with `redo`, a fresh one for all of them (replacing what is there). */
  async function handleAutoFillAllHindi(redo = false) {
    const todo = questions.filter((q) => q.question_text.trim() !== "" && (redo || !hasHindi(q)));
    if (todo.length === 0) { setHindiMessage("Every question already has a Hindi version (or is empty)."); return; }
    if (redo && !confirm(`Write the Hindi again for ${todo.length} question${todo.length === 1 ? "" : "s"}? What is there now (including your edits) will be replaced.`)) return;
    setHindiBusy(true);
    setHindiMessage("");
    try {
      const patches = await translateQuestionsToHindi(todo, (done, total) => setHindiMessage(`Writing Hindi… ${done} of ${total}`));
      const byId = new Map(todo.map((q, i) => [q.localId, patches[i]]));
      setQuestions((prev) => prev.map((q) => (byId.has(q.localId) ? { ...q, ...byId.get(q.localId)! } : q)));
      setHindiMessage(`✅ Hindi added to ${todo.length} question${todo.length === 1 ? "" : "s"}. Open "🇮🇳 हिंदी version" under a question to check or edit it, then Save.`);
    } catch (e) {
      setHindiMessage(e instanceof Error ? e.message : "Could not auto-fill Hindi.");
    } finally {
      setHindiBusy(false);
    }
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
      if (form.code && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,15}$/.test(form.code.trim())) {
        setError("The test code can only have letters, numbers, - and _ (up to 16 characters), e.g. V001.");
        return null;
      }

      // Questions that are also used in other tests and were edited here: ask whether the other tests should get the change too.
      let toSave = questions;
      let updateUids: string[] = [];
      if (savedQuizId) {
        const changed = questions.filter((q) => q.origin_uid && baseline.current.has(q.origin_uid) && baseline.current.get(q.origin_uid) !== questionContentKey(q));
        if (changed.length > 0) {
          const fresh = await getQuestionLinks(changed.map((q) => q.origin_uid as string), savedQuizId);
          const items: SyncItem[] = changed
            .map((q) => ({
              uid: q.origin_uid as string,
              label: `Q${questionNumber.get(q.localId) ?? questions.indexOf(q) + 1} - ${q.question_text.trim().slice(0, 70)}`,
              links: fresh.filter((l) => l.origin_uid === q.origin_uid),
            }))
            .filter((it) => it.links.length > 0);
          if (items.length > 0) {
            const choice = await askSync(items);
            if (choice === null) return null; // cancelled: nothing was saved
            updateUids = choice;
            const unlink = new Set(items.map((it) => it.uid).filter((uid) => !choice.includes(uid)));
            if (unlink.size > 0) {
              toSave = questions.map((q) => (q.origin_uid && unlink.has(q.origin_uid) ? { ...q, origin_uid: crypto.randomUUID(), home_quiz_id: savedQuizId } : q));
              setQuestions(toSave);
            }
          }
        }
      }

      let id = savedQuizId;
      if (!id) {
        const created = await createQuiz(admin.company_id, admin.id, { ...form, code: form.code?.trim() || undefined, location_id: form.location_id === undefined ? selectedLocationId : form.location_id });
        id = created.id;
        setSavedQuizId(id);
      } else {
        await updateQuizMeta(id, { ...form, location_id: form.location_id === undefined ? selectedLocationId : form.location_id });
      }

      const result = await saveQuestions(
        id,
        toSave.map(({ localId: _localId, ...rest }) => rest)
      );
      if (!result.ok) {
        setError(result.error ?? "Could not save questions.");
        return null;
      }

      // questions the trainer chose to delete from every test
      let extra = "";
      if (deleteEverywhere.current.size > 0) {
        try {
          const gone = await deleteQuestionCopies(id, [...deleteEverywhere.current]);
          deleteEverywhere.current = new Set();
          if (gone.deleted.length > 0) extra += ` Also deleted from ${gone.deleted.map((u) => u.code).join(", ")}.`;
          if (gone.skipped.length > 0) extra += ` ${gone.skipped.map((u) => u.code).join(", ")} ${gone.skipped.length === 1 ? "is" : "are"} running or scheduled right now, so the question was kept there.`;
        } catch (e) {
          setError(`Saved here, but the question could not be deleted from the other tests: ${e instanceof Error ? e.message : "unknown error"}`);
        }
      }

      // the other tests now get the same version
      if (updateUids.length > 0) {
        try {
          const outcome = await syncQuestionCopies(id, updateUids);
          if (outcome.updated.length > 0) extra += ` Also updated in ${outcome.updated.map((u) => u.code).join(", ")}.`;
          if (outcome.skipped.length > 0) extra += ` ${outcome.skipped.map((u) => u.code).join(", ")} ${outcome.skipped.length === 1 ? "is" : "are"} running or scheduled right now, so ${outcome.skipped.length === 1 ? "it was" : "they were"} not changed.`;
        } catch (e) {
          setError(`Saved here, but the other tests could not be updated: ${e instanceof Error ? e.message : "unknown error"}`);
        }
      }
      void refreshLinks(toSave, id);

      if (publish) {
        await publishQuiz(id);
        setNotice(`Quiz published!${extra}`);
      } else {
        setNotice(`Draft saved.${extra}`);
      }
      return id;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save.";
      setError(/quizzes_company_code_uq|duplicate key/i.test(message) ? `The test code ${form.code?.trim().toUpperCase()} is already used by another test. Pick a different one.` : message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  function askSync(items: SyncItem[]): Promise<string[] | null> {
    return new Promise((resolve) => {
      syncResolver.current = resolve;
      setSyncAsk(items);
    });
  }

  function answerSync(uids: string[] | null) {
    setSyncAsk(null);
    syncResolver.current?.(uids);
    syncResolver.current = null;
  }

  // ── pick questions: new test / copy / move ──
  function toggleSelected(localId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(localId)) next.delete(localId);
      else next.add(localId);
      return next;
    });
  }

  async function handleTransfer(req: TransferRequest): Promise<TransferOutcome> {
    if (!admin) throw new Error("Sign in again.");
    if (!savedQuizId) throw new Error("Save this test first (Save as Draft), then you can send its questions to another test.");
    const chosen = questions.filter((q) => selected.has(q.localId));
    if (chosen.length === 0) throw new Error("Tick at least one question.");

    // a question that was never saved gets its identity now, so the copy stays linked to it
    const withIdentity = chosen.map((q) => (q.origin_uid ? q : { ...q, origin_uid: crypto.randomUUID(), home_quiz_id: savedQuizId }));
    const byId = new Map(withIdentity.map((q) => [q.localId, q]));
    setQuestions((prev) => prev.map((q) => byId.get(q.localId) ?? q));
    const copies = withIdentity.map((q) => questionForOtherTest(q, req.linked, form.title.trim() || "another test"));

    let message: string;
    let openUrl: string | undefined;
    if (req.kind === "new") {
      const created = await createTestFromQuestions(
        admin.company_id,
        admin.id,
        { ...form, description: "", code: undefined, location_id: form.location_id === undefined ? selectedLocationId : form.location_id },
        req.title,
        req.code,
        copies
      );
      message = `Created ${created.code} · ${created.title} with ${copies.length} question${copies.length === 1 ? "" : "s"}. It is a draft - open it, check it and publish.`;
      openUrl = (created.mode === "exam" ? ROUTES.QUIZ_ADMIN_EXAM_EDIT : ROUTES.QUIZ_ADMIN_BUILDER_EDIT).replace(":quizId", created.id);
    } else {
      const result = await copyQuestionsToTest(req.target, copies);
      message = `${req.kind === "move" ? "Moved" : "Copied"} ${result.added} question${result.added === 1 ? "" : "s"} to ${req.target.code} · ${req.target.title}.`;
      if (result.skippedWritten > 0) message += ` ${result.skippedWritten} typed-answer question${result.skippedWritten === 1 ? " was" : "s were"} left out because that is a live quiz.`;
      openUrl = (req.target.mode === "exam" ? ROUTES.QUIZ_ADMIN_EXAM_EDIT : ROUTES.QUIZ_ADMIN_BUILDER_EDIT).replace(":quizId", req.target.id);
      if (req.kind === "move") {
        const movedIds = new Set(withIdentity.filter((q) => req.target.mode === "exam" || q.type !== "written").map((q) => q.localId));
        const remaining = questions.filter((q) => !movedIds.has(q.localId));
        setQuestions(remaining.length > 0 ? remaining : [blankQuestion()]);
        message += " They are removed from this test on screen - press Save to keep that.";
      }
    }
    setSelected(new Set());
    void refreshLinks(questions.map((q) => byId.get(q.localId) ?? q), savedQuizId, false);
    return { message, openUrl };
  }

  // This same toggle also lives in Settings' quiz list, as an instant-save
  // switch (no separate Save click) — it edits the exact same
  // issue_certificate column. Left as a plain field-in-the-form here, this
  // one only took effect on the next "Save Draft"/"Publish" click, which
  // reads as "the option doesn't work" if you toggle it and navigate away.
  // For an already-saved quiz, save it immediately too, same as Settings;
  // a brand-new unsaved quiz has nothing to save yet, so it just updates
  // the form as before.
  async function handleToggleCertificate(next: boolean) {
    setForm((f) => ({ ...f, issue_certificate: next }));
    if (savedQuizId) {
      await updateQuizMeta(savedQuizId, { issue_certificate: next });
    }
  }

  async function handleSaveDraft() {
    const id = await persist(false);
    if (id && isNew) navigate(editRoute.replace(":quizId", id), { replace: true });
  }

  async function handlePublish() {
    const id = await persist(true);
    if (id && isNew) navigate(editRoute.replace(":quizId", id), { replace: true });
  }

  if (loading) return <div className="text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-8 pb-16">
      <h1 className="text-xl font-bold text-white">{isNew ? (isExam ? "Create New Exam" : "Create New Quiz") : isExam ? "Edit Exam" : "Edit Quiz"}</h1>

      {error && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
      )}
      {notice && (
        <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
          {notice}
        </div>
      )}
      {resyncError && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{resyncError}</div>
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
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Test code</label>
          <input
            className="w-full sm:max-w-[12rem] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 font-mono text-sm uppercase text-white outline-none focus:border-violet-500"
            value={form.code ?? ""}
            maxLength={16}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, "") })}
            placeholder={isNew ? "auto, e.g. V001" : "V001"}
          />
          <p className="mt-1 text-xs text-slate-500">
            A short name for finding this {isExam ? "exam" : "quiz"}, e.g. V001 for Vatika. Questions you merge or copy from it keep this code, so a change to a shared question can follow it everywhere.
            {isNew ? " Leave it empty and one is made from the title." : ""}
          </p>
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
        {(allLocations.length > 0 || form.location_id) && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">📍 Location</label>
            <select
              className="w-full sm:max-w-xs rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={(form.location_id === undefined ? selectedLocationId : form.location_id) ?? ""}
              onChange={(e) => setForm({ ...form, location_id: e.target.value || null })}
            >
              <option value="">No location (shows under “All locations” only)</option>
              {allLocations
                .filter((l) => l.active || l.id === form.location_id)
                .map((l) => (
                  <option key={l.id} value={l.id}>{l.name}{l.active ? "" : " (hidden)"}</option>
                ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">When you pick a location at the top, only that location's {isExam ? "exams" : "quizzes"} are shown. Add more locations in Settings → Locations.</p>
          </div>
        )}
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
          {isExam ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Paper time (min)</label>
              <input
                type="number"
                min={1}
                max={1440}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                value={form.exam_duration_minutes ?? ""}
                onChange={(e) => setForm({ ...form, exam_duration_minutes: e.target.value ? Number(e.target.value) : null })}
                placeholder="60"
              />
            </div>
          ) : (
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
            {questions.some((q) => q.timer_seconds !== null) && (
              <p className="mt-1.5 text-[11px] leading-snug text-amber-300">
                {questions.filter((q) => q.timer_seconds !== null).length} of {questions.length} questions have their own timer, so they do not follow this one.{" "}
                <button
                  type="button"
                  onClick={() => setQuestions((prev) => prev.map((q) => ({ ...q, timer_seconds: null })))}
                  className="font-semibold underline hover:text-amber-200"
                >
                  Use {form.default_timer_seconds}s for all questions
                </button>
              </p>
            )}
          </div>
          )}
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
          {isExam ? "Shuffle the options of each question differently for every employee" : "Shuffle answer order for each player (A/B/C/D will differ on every phone)"}
        </label>
        {!isExam && (
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.shuffle_questions}
            onChange={(e) => setForm({ ...form, shuffle_questions: e.target.checked })}
          />
          Shuffle question order for each session
        </label>
        )}
        <label className="flex items-start gap-2 text-sm text-slate-300 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.shuffle_questions_per_participant}
            onChange={(e) => setForm({ ...form, shuffle_questions_per_participant: e.target.checked })}
          />
          <span>
            🕵️ Anti-cheat: different question order for every employee
            <span className="block text-xs text-slate-500 mt-0.5">
              {isExam
                ? "Every employee gets the same paper, but in their own order — copying a neighbor's screen won't help."
                : "Each device gets its own shuffled order of the same questions — copying a neighbor's screen won't help. When on, the host/TV screen shows progress only, not which specific question is live (there isn't just one anymore)."}
            </span>
          </span>
        </label>
        {!isExam && (() => {
          const mode = describePlayMode(form);
          return (
            <div className={`rounded-lg border px-3 py-2.5 text-xs space-y-1 ${mode.sameOnEveryScreen ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200" : "border-amber-500/30 bg-amber-500/5 text-amber-200"}`}>
              <div className="font-semibold uppercase tracking-wide text-[10px] opacity-80">What players will see</div>
              <div>{mode.questions.icon} {mode.questions.text}</div>
              <div>{mode.answers.icon} {mode.answers.text}</div>
              {!mode.sameOnEveryScreen && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, shuffle_options: false, shuffle_questions_per_participant: false })}
                  className="mt-1 rounded-md bg-amber-400 px-2.5 py-1 font-semibold text-amber-950 hover:bg-amber-300"
                >
                  🎯 Make it the same on every screen
                </button>
              )}
            </div>
          );
        })()}
        <div className="rounded-lg border border-slate-700 px-3 py-2.5 space-y-1.5">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {isExam ? "Tell candidates right / wrong while they answer" : "Tell players right / wrong while they answer"}
          </label>
          <select
            className="w-full sm:max-w-md rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            value={form.reveal_answers === null || form.reveal_answers === undefined ? "default" : form.reveal_answers ? "show" : "hide"}
            onChange={(e) => setForm({ ...form, reveal_answers: e.target.value === "default" ? null : e.target.value === "show" })}
          >
            <option value="default">Follow my default setting</option>
            <option value="show">Show right / wrong immediately</option>
            <option value="hide">Hide it — they see results only at the end</option>
          </select>
          <p className="text-xs text-slate-500">
            {isExam
              ? "Decided when the exam is started and frozen for that exam. Hidden means the screen shows nothing about right or wrong, and the answer is never sent to the phone."
              : "Decided when the quiz is launched and frozen for that session. Hidden means players only see that their answer was recorded — nothing about right or wrong, points or the correct option, and it is never sent to the phone. Your default is in Quiz Settings."}
          </p>
        </div>
        {!isExam && (
          <div className="rounded-lg border border-slate-700 px-3 py-2.5 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">Let players move ahead when they finish early</label>
            <select
              className="w-full sm:max-w-md rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={form.allow_early_next === null || form.allow_early_next === undefined ? "default" : form.allow_early_next ? "allow" : "deny"}
              onChange={(e) => setForm({ ...form, allow_early_next: e.target.value === "default" ? null : e.target.value === "allow" })}
            >
              <option value="default">Follow my default setting</option>
              <option value="allow">Allow — players can press Next after answering</option>
              <option value="deny">Do not allow — everyone moves together</option>
            </select>
            <p className="text-xs text-slate-500">
              Decided when the quiz is launched. Allowed: after answering, a player sees a “Next question” button; it moves only that player and the next question gets its own full timer.
              Your host screen, timer, leaderboard and results stay exactly the same, and nobody gets stuck (a player who does not press Next is moved on with the host).
              Players who move ahead see upcoming questions before the room, so it suits practice quizzes better than strict tests.
            </p>
          </div>
        )}
        <div className="rounded-lg border border-slate-700 px-3 py-2.5 space-y-1.5">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">🖼️ Background behind the questions (trainee's screen)</label>
          <select
            className="w-full sm:max-w-md rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            value={form.bg_kind ?? "default"}
            onChange={(e) => setForm({ ...form, bg_kind: e.target.value === "default" ? null : (e.target.value as "none" | "logo" | "image") })}
          >
            <option value="default">Follow my default setting</option>
            <option value="none">None — plain screen for this {isExam ? "exam" : "quiz"}</option>
            <option value="logo">Company logo, faded</option>
            <option value="image">An image of my own for this {isExam ? "exam" : "quiz"}…</option>
          </select>
          {form.bg_kind === "image" && admin && (
            <QuizBrandingImageField
              label="Image for this background"
              hint="Kept faint and under a dark layer so the text stays readable. Strength and position come from Quiz Settings → Background."
              value={form.bg_image_url ?? null}
              kind="screen-background"
              companyId={admin.company_id}
              onChange={(url) => setForm({ ...form, bg_image_url: url })}
            />
          )}
          <p className="text-xs text-slate-500">Your default (and the optional trainee-name watermark) is in Quiz Settings → Background behind the Questions.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.issue_certificate}
            onChange={(e) => handleToggleCertificate(e.target.checked)}
          />
          🏆 Issue certificate for passing this quiz
        </label>
        {!form.issue_certificate && (
          <p className="text-xs text-slate-500 -mt-2">No certificate will be offered for this quiz, regardless of score — useful for practice/ungraded quizzes.</p>
        )}
      </fieldset>

      {/* Download the whole test (what is on screen right now) */}
      {questions.some((q) => q.question_text.trim() !== "") && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <QuizDownloadMenu load={async () => buildExportQuiz()} />
          <p className="min-w-[14rem] flex-1 text-xs text-slate-500">
            Download this whole {isExam ? "exam" : "quiz"} — every question with its options, the correct answer and the explanation — as a PDF or a CSV (Excel) file.
            It is made from what you see on this screen now, even before you save.
          </p>
        </div>
      )}

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

      {/* Hindi version of every question */}
      {canEdit && (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">🇮🇳 हिंदी version of the questions</h2>
        <p className="text-xs text-slate-500">
          Trainees who prefer Hindi get a language switch on every question that has a Hindi version (Devanagari with the usual English
          words kept in English). Auto-fill writes a first draft for all questions that have none yet - you can read and edit each one
          under its question before saving.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleAutoFillAllHindi()}
            disabled={hindiBusy}
            className="text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
          >
            {hindiBusy ? "Writing Hindi…" : "✨ Auto-fill Hindi for all questions"}
          </button>
          {questions.some(hasHindi) && (
            <>
              <button
                type="button"
                onClick={() => void handleAutoFillAllHindi(true)}
                disabled={hindiBusy}
                className="text-xs font-semibold border border-slate-600 text-slate-200 hover:bg-slate-800 rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                ↻ Write again for all
              </button>
              <button
                type="button"
                onClick={handleRemoveAllHindi}
                disabled={hindiBusy}
                className="text-xs font-semibold border border-red-500/40 text-red-300 hover:bg-red-500/10 rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                🗑 Remove Hindi from all
              </button>
            </>
          )}
          {hindiMessage && <span className="text-xs text-slate-300">{hindiMessage}</span>}
        </div>
      </div>
      )}

      {/* Questions */}
      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">
            {activeQuestionCount} question(s) <span className="text-slate-500 font-normal">· {totalMarks} marks total</span>
            {hiddenQuestionCount > 0 && (
              <span className="ml-2 text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5 align-middle">
                🙈 {hiddenQuestionCount} hidden — not counted
              </span>
            )}
          </h2>
          {canEdit && (
          <button
            onClick={addQuestion}
            className="text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-3 py-1.5"
          >
            + Add Question
          </button>
          )}
        </div>

        {canEdit && questions.length > 0 && (
          <div className={`sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${selected.size > 0 ? "border-violet-500/60 bg-slate-900/95 backdrop-blur" : "border-dashed border-slate-700 bg-slate-900/60"}`}>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-violet-500"
                checked={selected.size > 0 && selected.size === questions.length}
                onChange={(e) => setSelected(e.target.checked ? new Set(questions.map((q) => q.localId)) : new Set())}
              />
              {selected.size > 0 ? `${selected.size} selected` : "Select questions"}
            </label>
            {selected.size === 0 ? (
              <span className="text-[11px] text-slate-500">Tick questions to make a new test from them, or copy / move them to another test.</span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setTransferOpen(true)}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
                >
                  ✨ New test · 📋 Copy · ➡ Move…
                </button>
                <span className="flex items-center gap-1.5">
                  <input
                    list="quiz-topic-choices"
                    value={bulkTopic}
                    maxLength={60}
                    onChange={(e) => setBulkTopic(e.target.value)}
                    placeholder="Topic for these…"
                    className="w-40 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-xs text-white outline-none focus:border-violet-500"
                  />
                  <button
                    type="button"
                    disabled={!bulkTopic.trim()}
                    onClick={() => {
                      const topic = bulkTopic.trim();
                      setQuestions((prev) => prev.map((q) => (selected.has(q.localId) ? { ...q, topic } : q)));
                      setTopicChoices((prev) => (prev.includes(topic) ? prev : [topic, ...prev]));
                      setBulkTopic("");
                    }}
                    className="rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                  >
                    🏷 Set topic
                  </button>
                </span>
                <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-semibold text-slate-400 hover:text-white">Clear</button>
              </>
            )}
          </div>
        )}

        {canEdit && sourceLabelCounts.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-slate-900/60 border border-dashed border-slate-700 rounded-xl px-3 py-2.5">
            <span className="text-xs font-semibold text-slate-400">🧹 Remove a merged-in project:</span>
            <select
              value={removeSourceChoice}
              onChange={(e) => setRemoveSourceChoice(e.target.value)}
              className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
            >
              <option value="">Choose a source project…</option>
              {[...sourceLabelCounts.entries()].map(([label, count]) => (
                <option key={label} value={label}>
                  {label} ({count} question{count === 1 ? "" : "s"})
                </option>
              ))}
            </select>
            <button
              onClick={handleRemoveSourceClick}
              disabled={!removeSourceChoice}
              className="text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-lg px-3 py-1.5"
            >
              🗑 Remove Its Questions
            </button>
          </div>
        )}

        {canEdit && bulkGroups.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-slate-900/60 border border-dashed border-slate-700 rounded-xl px-3 py-2.5">
            {bulkGroups.map((g) => (
              <button
                key={g.imageUrl}
                onClick={() => setBulkMarkImage(g.imageUrl)}
                className="text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-lg px-3 py-1.5"
              >
                🗺 Mark all {g.items.length} map questions on one screen ({g.items.filter((i) => i.zones.length > 0).length} done)
              </button>
            ))}
            <span className="text-xs text-slate-500">Questions sharing the same map image can all be marked in one place.</span>
          </div>
        )}

        {questions.map((q, qi) => (
          <div key={q.localId} className={`bg-slate-900 border rounded-2xl p-5 space-y-3 ${q.is_hidden ? "border-amber-700/50 opacity-60" : "border-slate-800"}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {canEdit && (
                  <input
                    type="checkbox"
                    checked={selected.has(q.localId)}
                    onChange={() => toggleSelected(q.localId)}
                    title="Tick to make a new test from the ticked questions, or to copy / move them to another test"
                    className="h-4 w-4 accent-violet-500"
                  />
                )}
                <span className="text-xs font-mono text-slate-500 bg-slate-800 rounded px-2 py-0.5">{q.is_hidden ? "Hidden" : `Q${questionNumber.get(q.localId) ?? qi + 1}`}</span>
                {q.origin_uid && (links.get(q.origin_uid)?.length ?? 0) > 0 && (() => {
                  const where = links.get(q.origin_uid as string) as QuestionLink[];
                  return (
                    <span
                      title={`Also in: ${where.map((l) => `${l.code} ${l.title}${l.is_home ? " (original)" : ""}`).join(" · ")}. Changes made here can update these too - you are asked when you save.`}
                      className="text-[10px] font-semibold text-sky-300 bg-sky-500/10 border border-sky-500/30 rounded-full px-2 py-0.5"
                    >
                      🔗 {where.slice(0, 3).map((l) => l.code).join(", ")}{where.length > 3 ? ` +${where.length - 3}` : ""}
                    </span>
                  );
                })()}
                {q.type === "hotspot" && effectiveZones(q).length === 0 && (
                  <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
                    ⚠ {q.image_url ? "Area not marked" : "Image needed"}
                  </span>
                )}
                {q.source_label && (
                  <span title="Came in via merge" className="text-[10px] font-semibold text-violet-300 bg-violet-500/10 border border-violet-500/30 rounded-full px-2 py-0.5">
                    📎 {q.source_label}
                  </span>
                )}
                {(q.source_question_id || (q.origin_uid && q.home_quiz_id && q.home_quiz_id !== savedQuizId)) && (
                  <button
                    onClick={() => handleResync(q.localId, q.source_question_id, q.origin_uid, q.home_quiz_id)}
                    disabled={resyncingId === q.localId}
                    title="Pull the latest content from the original question — overwrites this copy's text/options/image below. Click Save/Publish afterward to keep it."
                    className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5 hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {resyncingId === q.localId ? "Syncing…" : "🔄 Sync from source"}
                  </button>
                )}
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
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white"
                  value={q.type}
                  onChange={(e) => changeQuestionType(q.localId, e.target.value as EditableQuestion["type"])}
                >
                  <option value="mcq">Multiple Choice</option>
                  <option value="truefalse">True / False</option>
                  <option value="hotspot">Click-the-Map</option>
                  {isExam && <option value="written">Written answer</option>}
                </select>
                <label className="flex items-center gap-1 text-xs text-slate-400" title="Marks for this question">
                  <span>Marks</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="w-14 text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white"
                    value={q.marks}
                    onChange={(e) => updateQuestion(q.localId, { marks: e.target.value ? Number(e.target.value) : 1 })}
                  />
                </label>
                {!isExam && (
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
                )}
                {!isExam && q.timer_seconds !== null && (
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
                  onClick={() => handleRemoveQuestionClick(q.localId)}
                  title="Delete this question"
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

            {q.type === "written" ? (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-4 py-3 text-xs text-slate-400">
                ✍️ Employees type their answer and/or attach photos of a handwritten one. You mark it by hand after the exam. Put the model answer in the box below — only you see it.
              </div>
            ) : q.type === "hotspot" ? (
              <>
              {effectiveZones(q).length > 1 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100 flex flex-wrap items-center gap-2">
                  <span className="flex-1 min-w-[200px]">
                    This map has {effectiveZones(q).length} spots in ONE question. Split it into {effectiveZones(q).length} questions — same map, one spot each — so every spot is asked, tapped and marked on its own.
                  </span>
                  <button
                    onClick={() => {
                      if (confirm(`Split into ${effectiveZones(q).length} separate questions (one spot each)? You can still edit them afterwards; nothing is saved until you press Save/Publish.`)) splitHotspotQuestion(q.localId);
                    }}
                    className="rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-slate-900 hover:bg-amber-300"
                  >
                    ✂ Split into {effectiveZones(q).length} questions
                  </button>
                </div>
              )}
              <HotspotZoneEditor
                companyId={admin?.company_id ?? ""}
                imageUrl={q.image_url}
                zones={effectiveZones(q)}
                onChange={(patch) => updateQuestion(q.localId, patch)}
              />
              </>
            ) : (
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
            )}

            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-violet-500"
              placeholder={isExam ? "Model answer / explanation (optional, only you see it)" : "Explanation (optional, shown after answering)"}
              value={q.explanation}
              onChange={(e) => updateQuestion(q.localId, { explanation: e.target.value })}
            />

            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-semibold text-slate-400">🏷 Topic</span>
              <input
                list="quiz-topic-choices"
                maxLength={60}
                className="w-full sm:max-w-xs rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-violet-500"
                placeholder="optional - e.g. RERA, Payment plan"
                value={q.topic ?? ""}
                onChange={(e) => updateQuestion(q.localId, { topic: e.target.value })}
                onBlur={(e) => {
                  const t = e.target.value.trim();
                  if (t && !topicChoices.includes(t)) setTopicChoices((prev) => [t, ...prev]);
                }}
              />
            </div>

            <QuestionHindiPanel question={q} onChange={(patch) => updateQuestion(q.localId, patch)} />
          </div>
        ))}
      </fieldset>
      <datalist id="quiz-topic-choices">
        {topicChoices.map((t) => <option key={t} value={t} />)}
      </datalist>

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

      {bulkMarkImage && (
        <HotspotBulkMarker
          imageUrl={bulkMarkImage}
          items={bulkGroups.find((g) => g.imageUrl === bulkMarkImage)?.items ?? []}
          onZonesChange={handleBulkZonesChange}
          onClose={() => setBulkMarkImage(null)}
        />
      )}
      {transferOpen && admin && (
        <QuestionTransferModal
          companyId={admin.company_id}
          count={selected.size}
          currentQuizId={savedQuizId}
          currentTitle={form.title}
          onClose={() => setTransferOpen(false)}
          onConfirm={handleTransfer}
        />
      )}
      {deleteAsk && (
        <DeleteChoiceModal
          label={deleteAsk.label}
          thisTitle={form.title}
          links={deleteAsk.links}
          onCancel={() => setDeleteAsk(null)}
          onChoose={(everywhere) => {
            const q = questions.find((x) => x.localId === deleteAsk.localId);
            if (everywhere && q?.origin_uid) deleteEverywhere.current.add(q.origin_uid);
            removeQuestion(deleteAsk.localId);
            setDeleteAsk(null);
          }}
        />
      )}
      {syncAsk && <SyncChoiceModal items={syncAsk} thisTitle={form.title} onCancel={() => answerSync(null)} onConfirm={(uids) => answerSync(uids)} />}
    </div>
  );
}
