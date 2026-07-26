// Company-scoped backup/restore for the Live Quiz module — a JSON export of
// everything an admin builds by hand (categories, trainee roster, quizzes +
// questions + options, appearance/branding/certificate settings) so it can be
// re-imported if data is ever lost, or carried between companies.
// Import is always additive (never deletes or overwrites existing rows) —
// same principle used for the legacy InfraMantra data recovery earlier: it's
// far safer to end up with a duplicate than to silently wipe live data.

import * as quizRepo from "../../repositories/quiz/quizRepository";
import { listCategories, createCategory } from "../../repositories/quiz/quizCategoryRepository";
import { listRoster, addRosterEntry } from "../../repositories/quiz/quizRosterRepository";
import { getSettings, saveSettings } from "../../repositories/quiz/quizSettingsRepository";
import type { QuizDifficulty, QuizStatus, QuizQuestionType, QuizSettings } from "../../types/quiz";

const BACKUP_VERSION = 1;

interface BackupOption {
  option_text: string;
  is_correct: boolean;
}

interface BackupQuestion {
  question_text: string;
  type: QuizQuestionType;
  timer_seconds: number | null;
  marks: number;
  explanation: string;
  options: BackupOption[];
}

interface BackupQuiz {
  title: string;
  description: string;
  category_name: string | null;
  difficulty: QuizDifficulty;
  default_timer_seconds: number;
  passing_score_pct: number;
  improve_threshold_pct: number;
  shuffle_options: boolean;
  shuffle_questions: boolean;
  status: QuizStatus;
  questions: BackupQuestion[];
}

export interface QuizBackup {
  version: number;
  exported_at: string;
  categories: { name: string; display_order: number }[];
  roster: { employee_code: string; name: string; phone: string; active: boolean }[];
  quizzes: BackupQuiz[];
  settings: Omit<QuizSettings, "company_id" | "updated_at">;
}

export async function exportBackup(companyId: string): Promise<QuizBackup> {
  const [categories, roster, quizzes, settings] = await Promise.all([
    listCategories(companyId),
    listRoster(companyId),
    quizRepo.listQuizzes(companyId),
    getSettings(companyId),
  ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  const fullQuizzes = await Promise.all(
    quizzes.map(async (q) => {
      const full = await quizRepo.getQuizWithQuestions(q.id);
      const backupQuiz: BackupQuiz = {
        title: q.title,
        description: q.description,
        category_name: q.category_id ? categoryNameById.get(q.category_id) ?? null : null,
        difficulty: q.difficulty,
        default_timer_seconds: q.default_timer_seconds,
        passing_score_pct: q.passing_score_pct,
        improve_threshold_pct: q.improve_threshold_pct,
        shuffle_options: q.shuffle_options,
        shuffle_questions: q.shuffle_questions,
        status: q.status,
        questions: (full?.questions ?? []).map((question) => ({
          question_text: question.question_text,
          type: question.type,
          timer_seconds: question.timer_seconds,
          marks: question.marks,
          explanation: question.explanation,
          options: question.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
        })),
      };
      return backupQuiz;
    })
  );

  const { company_id: _companyId, updated_at: _updatedAt, ...settingsRest } = settings;

  return {
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    categories: categories.map((c) => ({ name: c.name, display_order: c.display_order })),
    roster: roster.map((r) => ({ employee_code: r.employee_code, name: r.name, phone: r.phone, active: r.active })),
    quizzes: fullQuizzes,
    settings: settingsRest,
  };
}

export function downloadBackupFile(filename: string, backup: QuizBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseBackupFile(text: string): QuizBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  const backup = parsed as Partial<QuizBackup>;
  if (!backup || typeof backup !== "object" || !Array.isArray(backup.quizzes)) {
    throw new Error("That doesn't look like a Live Quiz backup file.");
  }

  return {
    version: backup.version ?? 1,
    exported_at: backup.exported_at ?? "",
    categories: backup.categories ?? [],
    roster: backup.roster ?? [],
    quizzes: backup.quizzes ?? [],
    settings: backup.settings ?? ({} as QuizBackup["settings"]),
  };
}

export interface RestoreOptions {
  restoreSettings: boolean;
}

export interface RestoreResult {
  categoriesAdded: number;
  rosterAdded: number;
  quizzesAdded: number;
}

/** Always additive — existing categories/roster entries (matched by name/employee_code) are left untouched, quizzes are always inserted as new rows (as drafts, so nothing goes live unreviewed). */
export async function importBackup(
  companyId: string,
  createdBy: string | null,
  backup: QuizBackup,
  options: RestoreOptions
): Promise<RestoreResult> {
  const existingCategories = await listCategories(companyId);
  const categoryIdByName = new Map(existingCategories.map((c) => [c.name.trim().toLowerCase(), c.id]));

  let categoriesAdded = 0;
  for (const cat of backup.categories) {
    const key = cat.name.trim().toLowerCase();
    if (categoryIdByName.has(key)) continue;
    const created = await createCategory(companyId, cat.name);
    categoryIdByName.set(key, created.id);
    categoriesAdded += 1;
  }

  const existingRoster = await listRoster(companyId);
  const existingCodes = new Set(existingRoster.map((r) => r.employee_code.trim().toLowerCase()));
  let rosterAdded = 0;
  for (const entry of backup.roster) {
    const key = entry.employee_code.trim().toLowerCase();
    if (existingCodes.has(key)) continue;
    await addRosterEntry(companyId, { employee_code: entry.employee_code, name: entry.name, phone: entry.phone });
    existingCodes.add(key);
    rosterAdded += 1;
  }

  let quizzesAdded = 0;
  for (const quiz of backup.quizzes) {
    const categoryId = quiz.category_name ? categoryIdByName.get(quiz.category_name.trim().toLowerCase()) ?? null : null;
    const created = await quizRepo.createQuiz(companyId, createdBy, {
      title: quiz.title,
      description: quiz.description,
      category_id: categoryId,
      difficulty: quiz.difficulty,
      default_timer_seconds: quiz.default_timer_seconds,
      passing_score_pct: quiz.passing_score_pct,
      improve_threshold_pct: quiz.improve_threshold_pct,
      shuffle_options: quiz.shuffle_options,
      shuffle_questions: quiz.shuffle_questions ?? false,
    });

    if (quiz.questions.length > 0) {
      await quizRepo.replaceQuestions(created.id, quiz.questions);
    }
    quizzesAdded += 1;
  }

  if (options.restoreSettings && backup.settings) {
    await saveSettings(companyId, backup.settings);
  }

  return { categoriesAdded, rosterAdded, quizzesAdded };
}
