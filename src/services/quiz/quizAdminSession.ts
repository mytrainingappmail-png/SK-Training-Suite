import type { QuizAdmin } from "../../types/quiz";

// Deliberately separate from src/services/auth/session.ts (SK_TRAINING_SESSION)
// — a quiz admin is never an LMS employee, and this key must never collide
// with it even though both can be present in the same browser at once.
const SESSION_KEY = "QUIZ_ADMIN_SESSION";

let cache: QuizAdmin | null = null;

export function setCurrentQuizAdmin(admin: QuizAdmin): void {
  cache = admin;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(admin));
  } catch {
    console.warn("[quizAdminSession] localStorage.setItem failed — session is memory-only.");
  }
}

export function getCurrentQuizAdmin(): QuizAdmin | null {
  return cache;
}

export function loadCurrentQuizAdmin(): QuizAdmin | null {
  if (cache) return cache;

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as QuizAdmin;
    if (!parsed || typeof parsed.id !== "string" || !parsed.id) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    cache = parsed;
    return cache;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

/** UI-level convenience only — RLS (current_quiz_admin_can_edit()) is the real enforcement boundary. */
export function canEditQuizContent(): boolean {
  return cache?.role === "super_admin" || cache?.permission_level === "edit";
}

export function clearCurrentQuizAdmin(): void {
  cache = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    console.warn("[quizAdminSession] localStorage.removeItem failed.");
  }
}
