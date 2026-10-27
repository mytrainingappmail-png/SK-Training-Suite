// The Hindi side of a quiz / exam on the trainee's phone. The English text is already on the screen; for the questions and
// options being shown, the Hindi version (if the trainer wrote one) is fetched by id and kept for the session, so switching
// language is instant. The trainee's choice is remembered on the device. Nothing is shown for a question without Hindi.

import { useEffect, useRef, useSyncExternalStore } from "react";
import { supabaseQuizPlayer } from "../../lib/supabaseQuizPlayer";

export type QuizLang = "en" | "hi";

const STORAGE_KEY = "rt-quiz-lang";
const langListeners = new Set<() => void>();

function readLang(): QuizLang {
  try {
    return localStorage.getItem(STORAGE_KEY) === "hi" ? "hi" : "en";
  } catch {
    return "en";
  }
}

let currentLang: QuizLang = readLang();

export function setQuizLang(lang: QuizLang): void {
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch { /* private mode - the choice just lasts until the page closes */ }
  langListeners.forEach((l) => l());
}

export function useQuizLang(): QuizLang {
  return useSyncExternalStore(
    (cb) => { langListeners.add(cb); return () => langListeners.delete(cb); },
    () => currentLang,
    () => "en" as QuizLang
  );
}

interface TranslationRow {
  question_id: string;
  question_text_hi: string | null;
  explanation_hi: string | null;
  option_id: string | null;
  option_text_hi: string | null;
}

/** Everything fetched so far for one session. */
interface SessionStore {
  questionText: Map<string, string>;
  explanation: Map<string, string>;
  optionText: Map<string, string>;
  optionToQuestion: Map<string, string>;
  /** ids already asked for (so the same id is never fetched twice) */
  asked: Set<string>;
  version: number;
  listeners: Set<() => void>;
}

const stores = new Map<string, SessionStore>();

function storeFor(sessionId: string): SessionStore {
  let s = stores.get(sessionId);
  if (!s) {
    s = { questionText: new Map(), explanation: new Map(), optionText: new Map(), optionToQuestion: new Map(), asked: new Set(), version: 0, listeners: new Set() };
    stores.set(sessionId, s);
  }
  return s;
}

async function fetchMissing(sessionId: string, ids: string[]): Promise<void> {
  const store = storeFor(sessionId);
  const missing = ids.filter((id) => id && !store.asked.has(id));
  if (missing.length === 0) return;
  missing.forEach((id) => store.asked.add(id));
  const { data, error } = await supabaseQuizPlayer.rpc("get_my_translations", { p_session_id: sessionId, p_ids: missing });
  if (error) {
    // not fatal - the English text stays; allow a retry the next time these ids are shown
    missing.forEach((id) => store.asked.delete(id));
    return;
  }
  for (const row of (data ?? []) as TranslationRow[]) {
    if (row.question_text_hi) store.questionText.set(row.question_id, row.question_text_hi);
    if (row.explanation_hi) store.explanation.set(row.question_id, row.explanation_hi);
    if (row.option_id) {
      store.optionToQuestion.set(row.option_id, row.question_id);
      if (row.option_text_hi) store.optionText.set(row.option_id, row.option_text_hi);
    }
  }
  store.version++;
  store.listeners.forEach((l) => l());
}

export interface Translations {
  /** True when at least one of the asked-for questions / options has a Hindi version. */
  any: boolean;
  question: (questionId: string) => string | null;
  option: (optionId: string) => string | null;
  /** The Hindi explanation of a question (only given once its explanation may be seen). */
  explanation: (questionId: string) => string | null;
  /** For screens that know a question only by its options (the answer sheet): its id, found through any of its option ids. */
  questionIdOfOptions: (optionIds: string[]) => string | null;
}

const NONE: Translations = { any: false, question: () => null, option: () => null, explanation: () => null, questionIdOfOptions: () => null };

/** Fetches (once) and returns the Hindi side for these question / option ids; re-renders when it arrives. */
export function useQuestionTranslations(sessionId: string | undefined, ids: string[], reloadKey?: string | number): Translations {
  const key = ids.join(",");
  const lastReload = useRef(reloadKey);
  useEffect(() => {
    if (!sessionId || ids.length === 0) return;
    // reloadKey changes when more may be shown than before (e.g. the quiz ended and explanations opened): ask again
    if (lastReload.current !== reloadKey) {
      lastReload.current = reloadKey;
      const store = storeFor(sessionId);
      ids.forEach((id) => store.asked.delete(id));
    }
    void fetchMissing(sessionId, ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, key, reloadKey]);

  useSyncExternalStore(
    (cb) => {
      if (!sessionId) return () => {};
      const store = storeFor(sessionId);
      store.listeners.add(cb);
      return () => store.listeners.delete(cb);
    },
    () => (sessionId ? storeFor(sessionId).version : 0),
    () => 0
  );

  if (!sessionId) return NONE;
  const store = storeFor(sessionId);
  return {
    any: store.questionText.size > 0 || store.optionText.size > 0,
    question: (id) => store.questionText.get(id) ?? null,
    option: (id) => store.optionText.get(id) ?? null,
    explanation: (id) => store.explanation.get(id) ?? null,
    questionIdOfOptions: (optionIds) => {
      for (const o of optionIds) {
        const q = store.optionToQuestion.get(o);
        if (q) return q;
      }
      return null;
    },
  };
}
