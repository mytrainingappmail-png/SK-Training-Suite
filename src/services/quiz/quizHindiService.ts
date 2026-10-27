// "Auto-fill Hindi" for the quiz / exam builder: asks the translate-quiz-hindi edge function for the Hindi (Devanagari with the
// common English words kept in English) version of some texts. Nothing is saved - the builder shows the result to edit.

import { supabaseQuiz } from "../../lib/supabaseQuiz";

/** The English texts in, the Hindi texts out (same order; an empty text stays empty). Throws a plain-words Error. */
export async function translateTextsToHindi(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];
  const { data, error } = await supabaseQuiz.functions.invoke("translate-quiz-hindi", { body: { texts } });
  if (error) {
    let message = "Auto-fill Hindi is not available right now. You can type the Hindi yourself.";
    try {
      const body = await (error as { context?: Response }).context?.json();
      if (body?.error) message = body.error;
    } catch { /* keep the generic sentence */ }
    throw new Error(message);
  }
  const out = (data as { texts?: unknown })?.texts;
  if (!Array.isArray(out) || out.length !== texts.length) throw new Error("Auto-fill Hindi gave an incomplete answer. Please try again.");
  return out.map((v) => (typeof v === "string" ? v : ""));
}

interface HindiQuestionLike {
  question_text: string;
  question_text_hi?: string | null;
  explanation: string;
  explanation_hi?: string | null;
  options: { option_text: string; option_text_hi?: string | null }[];
}

export function hasHindi(q: HindiQuestionLike): boolean {
  return !!(q.question_text_hi?.trim() || q.explanation_hi?.trim() || q.options.some((o) => o.option_text_hi?.trim()));
}

type HindiPatch<T extends HindiQuestionLike> = Pick<T, "question_text_hi" | "explanation_hi" | "options">;

/** One call carries at most this many texts (the function refuses more); several questions share a call to save quota. */
const TEXTS_PER_CALL = 40;

/** Translates the question, options and explanation of every question given; returns, per question, only the fields to set. */
export async function translateQuestionsToHindi<T extends HindiQuestionLike>(
  questions: T[],
  onProgress?: (done: number, total: number) => void
): Promise<HindiPatch<T>[]> {
  const textsOf = (q: T) => [q.question_text, q.explanation, ...q.options.map((o) => o.option_text)];
  const results: HindiPatch<T>[] = [];
  let start = 0;
  while (start < questions.length) {
    let end = start;
    let count = 0;
    while (end < questions.length && (end === start || count + textsOf(questions[end]).length <= TEXTS_PER_CALL)) {
      count += textsOf(questions[end]).length;
      end++;
    }
    const group = questions.slice(start, end);
    const out = await translateTextsToHindi(group.flatMap(textsOf));
    let at = 0;
    for (const q of group) {
      const n = 2 + q.options.length;
      results.push({
        question_text_hi: out[at],
        explanation_hi: out[at + 1],
        options: q.options.map((o, i) => ({ ...o, option_text_hi: out[at + 2 + i] })),
      } as HindiPatch<T>);
      at += n;
    }
    start = end;
    onProgress?.(end, questions.length);
  }
  return results;
}

export async function translateQuestionToHindi<T extends HindiQuestionLike>(q: T): Promise<HindiPatch<T>> {
  return (await translateQuestionsToHindi([q]))[0];
}
