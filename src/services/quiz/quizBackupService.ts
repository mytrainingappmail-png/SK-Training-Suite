// Company-scoped backup/restore for the Live Quiz module — a JSON export of
// everything an admin builds by hand (categories, trainee roster, quizzes +
// questions + options, appearance/branding/certificate settings) so it can be
// re-imported if data is ever lost, or carried between companies.
// Import is always additive (never deletes or overwrites existing rows) —
// same principle used for the legacy InfraMantra data recovery earlier: it's
// far safer to end up with a duplicate than to silently wipe live data.

import type { HotspotZone } from "../../types/quiz";
import * as quizRepo from "../../repositories/quiz/quizRepository";
import { listCategories, createCategory } from "../../repositories/quiz/quizCategoryRepository";
import { listRoster, addRosterEntry } from "../../repositories/quiz/quizRosterRepository";
import { getSettings, saveSettings } from "../../repositories/quiz/quizSettingsRepository";
import type { QuizDifficulty, QuizStatus, QuizQuestionType, QuizSettings, CertTemplateDraft } from "../../types/quiz";
import * as surveyRepo from "../../repositories/survey/surveyRepository";
import type { SurveySettings } from "../../types/survey";
import { listCertTemplateDrafts, createCertTemplateDraft, setActiveCertTemplateDraft } from "../../repositories/quiz/quizCertTemplatesRepository";

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
  is_hidden: boolean;
  source_label: string | null;
  options: BackupOption[];
  /** Only meaningful when type is "hotspot" — absent in a backup made before this field existed, so all optional. */
  image_url?: string | null;
  target_x?: number | null;
  target_y?: number | null;
  target_radius?: number | null;
  hotspot_zones?: HotspotZone[] | null;
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
  /** Absent in a backup made before this setting existed — restore defaults it to false. */
  shuffle_questions_per_participant?: boolean;
  issue_certificate: boolean;
  /** Absent in a backup made before Exams existed - treated as a Live Quiz. */
  mode?: "live" | "exam";
  exam_duration_minutes?: number | null;
  status: QuizStatus;
  questions: BackupQuestion[];
}

interface BackupSurvey {
  title: string;
  description: string;
  status: "draft" | "published" | "closed";
  questions: surveyRepo.SurveyQuestionForm[];
}

export interface QuizBackup {
  version: number;
  exported_at: string;
  categories: { name: string; display_order: number }[];
  roster: { employee_code: string; name: string; phone: string; active: boolean }[];
  quizzes: BackupQuiz[];
  settings: Omit<QuizSettings, "company_id" | "updated_at">;
  /** Absent in a backup made before surveys/certificates were included. */
  surveys?: BackupSurvey[];
  survey_settings?: Omit<SurveySettings, "company_id" | "updated_at">;
  cert_templates?: CertTemplateDraft[];
}

export async function exportBackup(companyId: string): Promise<QuizBackup> {
  const [categories, roster, quizzes, settings, surveyList, surveySettings, certTemplates] = await Promise.all([
    listCategories(companyId),
    listRoster(companyId),
    quizRepo.listQuizzes(companyId),
    getSettings(companyId),
    surveyRepo.listSurveys(companyId),
    surveyRepo.getSurveySettings(companyId),
    listCertTemplateDrafts(companyId),
  ]);

  const surveys: BackupSurvey[] = await Promise.all(
    surveyList.map(async (s) => {
      const full = await surveyRepo.getSurveyWithQuestions(s.id);
      return {
        title: s.title,
        description: s.description ?? "",
        status: s.status,
        questions: (full?.questions ?? []).map((q) => ({
          question_text: q.question_text,
          type: q.type,
          required: q.required,
          scale_min: q.scale_min,
          scale_max: q.scale_max,
          time_limit_seconds: q.time_limit_seconds ?? null,
          options: q.options.map((o) => ({ option_text: o.option_text, sentiment: o.sentiment })),
        })),
      };
    })
  );
  const { company_id: _surveyCompany, updated_at: _surveyUpdated, ...surveySettingsRest } = surveySettings;

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
        shuffle_questions_per_participant: q.shuffle_questions_per_participant,
        issue_certificate: q.issue_certificate,
        mode: q.mode,
        exam_duration_minutes: q.exam_duration_minutes,
        status: q.status,
        questions: (full?.questions ?? []).map((question) => ({
          question_text: question.question_text,
          type: question.type,
          timer_seconds: question.timer_seconds,
          marks: question.marks,
          explanation: question.explanation,
          is_hidden: question.is_hidden,
          source_label: question.source_label,
          options: question.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
          image_url: question.image_url,
          target_x: question.target_x,
          target_y: question.target_y,
          target_radius: question.target_radius,
          hotspot_zones: question.hotspot_zones,
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
    surveys,
    survey_settings: surveySettingsRest,
    cert_templates: certTemplates,
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
    surveys: backup.surveys ?? [],
    survey_settings: backup.survey_settings,
    cert_templates: backup.cert_templates ?? [],
  };
}

export interface RestoreOptions {
  restoreSettings: boolean;
}

export interface RestoreResult {
  categoriesAdded: number;
  rosterAdded: number;
  quizzesAdded: number;
  surveysAdded: number;
  certTemplatesAdded: number;
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
      shuffle_questions_per_participant: quiz.shuffle_questions_per_participant ?? false,
      issue_certificate: quiz.issue_certificate ?? true,
      mode: quiz.mode ?? "live",
      exam_duration_minutes: quiz.exam_duration_minutes ?? null,
    });

    if (quiz.questions.length > 0) {
      await quizRepo.replaceQuestions(
        created.id,
        quiz.questions.map((q) => ({
          ...q,
          is_hidden: q.is_hidden ?? false,
          source_label: q.source_label ?? null,
          // Never carried across a backup/restore — the id it would point
          // to belongs to a different database state (or doesn't exist at
          // all in the restoring company), so re-linking it here would be
          // meaningless at best and a dangling/wrong reference at worst.
          source_question_id: null,
          image_url: q.image_url ?? null,
          target_x: q.target_x ?? null,
          target_y: q.target_y ?? null,
          target_radius: q.target_radius ?? null,
          hotspot_zones: q.hotspot_zones ?? null,
        }))
      );
    }
    quizzesAdded += 1;
  }

  let surveysAdded = 0;
  for (const survey of backup.surveys ?? []) {
    const created = await surveyRepo.createSurvey(companyId, createdBy, { title: survey.title, description: survey.description, closes_at: null });
    await surveyRepo.replaceSurveyQuestions(created.id, survey.questions);
    surveysAdded += 1;
  }

  let certTemplatesAdded = 0;
  const existingTemplateNames = new Set((await listCertTemplateDrafts(companyId)).map((t) => t.name.trim().toLowerCase()));
  for (const tpl of backup.cert_templates ?? []) {
    if (existingTemplateNames.has(tpl.name.trim().toLowerCase())) continue;
    const created = await createCertTemplateDraft(companyId, tpl.name, tpl);
    if (options.restoreSettings && tpl.is_active) await setActiveCertTemplateDraft(created.id);
    existingTemplateNames.add(tpl.name.trim().toLowerCase());
    certTemplatesAdded += 1;
  }

  if (options.restoreSettings && backup.settings) {
    await saveSettings(companyId, backup.settings);
  }
  if (options.restoreSettings && backup.survey_settings) {
    await surveyRepo.saveSurveySettings(companyId, backup.survey_settings);
  }

  return { categoriesAdded, rosterAdded, quizzesAdded, surveysAdded, certTemplatesAdded };
}
