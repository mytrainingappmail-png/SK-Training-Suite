import { supabaseQuiz } from "../../lib/supabaseQuiz";
import type { Quiz, QuizQuestion, QuizWithQuestions, HotspotZone, QuizBackgroundKind } from "../../types/quiz";

export interface QuizForm {
  title: string;
  /** Short test code (V001). Leave out when creating - one is made from the title. */
  code?: string;
  description: string;
  category_id: string | null;
  difficulty: Quiz["difficulty"];
  default_timer_seconds: number;
  passing_score_pct: number;
  improve_threshold_pct: number;
  shuffle_options: boolean;
  shuffle_questions: boolean;
  shuffle_questions_per_participant: boolean;
  issue_certificate: boolean;
  mode: Quiz["mode"];
  exam_duration_minutes: number | null;
  /** null / absent = follow the company default */
  reveal_answers?: boolean | null;
  allow_early_next?: boolean | null;
  /** Background behind the questions on the trainee's screen: null / absent = follow the company default. */
  bg_kind?: QuizBackgroundKind | null;
  bg_image_url?: string | null;
  /** Where this quiz / exam is for (null = no location). */
  location_id?: string | null;
}

export interface QuestionOptionForm {
  option_text: string;
  /** Hindi version (Devanagari with common English words), optional. */
  option_text_hi?: string | null;
  is_correct: boolean;
}

/** The Hindi side of a question, carried along wherever a question is copied, merged, backed up or restored. */
export function hindiOf(q: { question_text_hi?: string | null; explanation_hi?: string | null }): { question_text_hi: string | null; explanation_hi: string | null } {
  return { question_text_hi: q.question_text_hi ?? null, explanation_hi: q.explanation_hi ?? null };
}

/** Every topic this company has used on its questions (for the suggestions while typing a topic), most used first. */
export async function listTopics(): Promise<string[]> {
  const { data, error } = await supabaseQuiz.from("quiz_questions").select("topic").not("topic", "is", null).limit(5000);
  if (error) {
    console.error("[quizRepository] listTopics:", error);
    return [];
  }
  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const t = (r.topic as string | null)?.trim();
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/** The topic of a question, carried along wherever a question is copied, merged, backed up or restored. */
export function topicOf(q: { topic?: string | null }): { topic: string | null } {
  return { topic: q.topic?.trim() || null };
}

/** The identity of a question, carried along when a question is copied INTO another test so the copies stay linked. */
export function originOf(q: { origin_uid?: string | null; home_quiz_id?: string | null }): { origin_uid: string | null; home_quiz_id: string | null } {
  return { origin_uid: q.origin_uid ?? null, home_quiz_id: q.home_quiz_id ?? null };
}

export function optionWithHindi(o: { option_text: string; is_correct: boolean; option_text_hi?: string | null }): QuestionOptionForm {
  return { option_text: o.option_text, is_correct: o.is_correct, option_text_hi: o.option_text_hi ?? null };
}

export interface QuestionForm {
  /** Shared by every copy of this question in other tests; null/absent = a new question gets its own. */
  origin_uid?: string | null;
  home_quiz_id?: string | null;
  /** What the question is about (optional) - feeds the topic report. */
  topic?: string | null;
  question_text: string;
  question_text_hi?: string | null;
  type: QuizQuestion["type"];
  timer_seconds: number | null;
  marks: number;
  explanation: string;
  explanation_hi?: string | null;
  is_hidden: boolean;
  source_label: string | null;
  /** See QuizQuestion — the original question this was copied from via merge, if any. */
  source_question_id: string | null;
  options: QuestionOptionForm[];
  /** Only meaningful when type is "hotspot" — see QuizQuestion for field meanings. */
  image_url: string | null;
  target_x: number | null;
  target_y: number | null;
  target_radius: number | null;
  hotspot_zones: HotspotZone[] | null;
}

export async function listQuizzes(companyId: string): Promise<Quiz[]> {
  const { data, error } = await supabaseQuiz
    .from("quizzes")
    .select("*")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[quizRepository] listQuizzes:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getQuizWithQuestions(quizId: string): Promise<QuizWithQuestions | null> {
  const { data: quiz, error: quizError } = await supabaseQuiz
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .maybeSingle();

  if (quizError) {
    console.error("[quizRepository] getQuizWithQuestions (quiz):", quizError);
    throw new Error(quizError.message);
  }
  if (!quiz) return null;

  const { data: questions, error: qError } = await supabaseQuiz
    .from("quiz_questions")
    .select("*, options:quiz_question_options(*)")
    .eq("quiz_id", quizId)
    .order("display_order", { ascending: true });

  if (qError) {
    console.error("[quizRepository] getQuizWithQuestions (questions):", qError);
    throw new Error(qError.message);
  }

  const sortedQuestions = (questions ?? []).map((q) => ({
    ...q,
    options: (q.options ?? []).slice().sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order),
  }));

  return { ...quiz, questions: sortedQuestions };
}

/** One question + its options, straight from the DB — used by the "sync from source" resync feature to fetch the current state of a merged question's original. */
export async function getQuestionById(questionId: string): Promise<QuizQuestion | null> {
  const { data, error } = await supabaseQuiz
    .from("quiz_questions")
    .select("*, options:quiz_question_options(*)")
    .eq("id", questionId)
    .maybeSingle();

  if (error) {
    console.error("[quizRepository] getQuestionById:", error);
    throw new Error(error.message);
  }
  if (!data) return null;

  return {
    ...data,
    options: (data.options ?? []).slice().sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order),
  };
}

/** The question as it lives in its home test, found by its shared identity (still works after that test was saved again, unlike a row id). */
export async function getQuestionByOrigin(originUid: string, homeQuizId: string): Promise<QuizQuestion | null> {
  const { data, error } = await supabaseQuiz
    .from("quiz_questions")
    .select("*, options:quiz_question_options(*)")
    .eq("origin_uid", originUid)
    .eq("quiz_id", homeQuizId)
    .maybeSingle();

  if (error) {
    console.error("[quizRepository] getQuestionByOrigin:", error);
    throw new Error(error.message);
  }
  if (!data) return null;
  return {
    ...data,
    options: (data.options ?? []).slice().sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order),
  };
}

export async function createQuiz(companyId: string, createdBy: string | null, form: QuizForm): Promise<Quiz> {
  const { data, error } = await supabaseQuiz
    .from("quizzes")
    .insert({ ...form, company_id: companyId, created_by: createdBy })
    .select()
    .single();

  if (error) {
    console.error("[quizRepository] createQuiz:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateQuizMeta(quizId: string, form: Partial<QuizForm>): Promise<Quiz> {
  const { data, error } = await supabaseQuiz
    .from("quizzes")
    .update({ ...form, updated_at: new Date().toISOString() })
    .eq("id", quizId)
    .select()
    .single();

  if (error) {
    console.error("[quizRepository] updateQuizMeta:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function setQuizStatus(quizId: string, status: Quiz["status"]): Promise<void> {
  const { error } = await supabaseQuiz
    .from("quizzes")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", quizId);

  if (error) {
    console.error("[quizRepository] setQuizStatus:", error);
    throw new Error(error.message);
  }
}

export async function deleteQuiz(quizId: string): Promise<void> {
  const { error } = await supabaseQuiz.from("quizzes").delete().eq("id", quizId);

  if (error) {
    console.error("[quizRepository] deleteQuiz:", error);
    throw new Error(error.message);
  }
}

/** One statement for the whole batch — questions/options/sessions/results
 * cascade per quiz exactly like a single deleteQuiz would, just for every
 * id at once (e.g. clearing out a handful of merged test quizzes that
 * never panned out). */
export async function deleteQuizzes(quizIds: string[]): Promise<void> {
  if (quizIds.length === 0) return;
  const { error } = await supabaseQuiz.from("quizzes").delete().in("id", quizIds);

  if (error) {
    console.error("[quizRepository] deleteQuizzes:", error);
    throw new Error(error.message);
  }
}

/** Replaces the whole question set for a quiz — matches the "edit in memory, save on publish" builder flow. */
export async function replaceQuestions(quizId: string, questions: QuestionForm[]): Promise<void> {
  const { error: delError } = await supabaseQuiz.from("quiz_questions").delete().eq("quiz_id", quizId);
  if (delError) {
    console.error("[quizRepository] replaceQuestions (delete):", delError);
    throw new Error(delError.message);
  }

  await insertQuestionRows(quizId, questions, 0);
}

/** Adds questions after the ones a test already has, without touching those (used by "copy / move questions to a test"). */
export async function appendQuestions(quizId: string, questions: QuestionForm[]): Promise<void> {
  if (questions.length === 0) return;
  const { data: last, error } = await supabaseQuiz
    .from("quiz_questions")
    .select("display_order")
    .eq("quiz_id", quizId)
    .order("display_order", { ascending: false })
    .limit(1);
  if (error) {
    console.error("[quizRepository] appendQuestions (position):", error);
    throw new Error(error.message);
  }
  await insertQuestionRows(quizId, questions, last && last.length > 0 ? last[0].display_order + 1 : 0);
}

async function insertQuestionRows(quizId: string, questions: QuestionForm[], startOrder: number): Promise<void> {
  if (questions.length === 0) return;

  const { data: insertedQuestions, error: qError } = await supabaseQuiz
    .from("quiz_questions")
    .insert(
      questions.map((q, i) => ({
        quiz_id: quizId,
        origin_uid: q.origin_uid ?? crypto.randomUUID(),
        home_quiz_id: q.home_quiz_id ?? quizId,
        topic: q.topic?.trim() || null,
        question_text: q.question_text,
        question_text_hi: q.question_text_hi?.trim() || null,
        type: q.type,
        timer_seconds: q.timer_seconds,
        marks: q.marks,
        explanation: q.explanation,
        explanation_hi: q.explanation_hi?.trim() || null,
        is_hidden: q.is_hidden,
        source_label: q.source_label,
        source_question_id: q.source_question_id,
        display_order: startOrder + i,
        image_url: q.image_url,
        target_x: q.target_x,
        target_y: q.target_y,
        target_radius: q.target_radius,
        hotspot_zones: q.hotspot_zones && q.hotspot_zones.length > 0 ? q.hotspot_zones : null,
      }))
    )
    .select("id");

  if (qError) {
    console.error("[quizRepository] insertQuestionRows (questions):", qError);
    throw new Error(qError.message);
  }

  const optionRows = (insertedQuestions ?? []).flatMap((row, qi) =>
    questions[qi].options.map((opt, oi) => ({
      question_id: row.id,
      option_text: opt.option_text,
      option_text_hi: opt.option_text_hi?.trim() || null,
      is_correct: opt.is_correct,
      display_order: oi,
    }))
  );

  if (optionRows.length === 0) return;

  const { error: oError } = await supabaseQuiz.from("quiz_question_options").insert(optionRows);
  if (oError) {
    console.error("[quizRepository] insertQuestionRows (options):", oError);
    throw new Error(oError.message);
  }
}
