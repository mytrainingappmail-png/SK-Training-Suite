// src/services/course/courseCsvService.ts
//
// Bulk CSV import for Category + Course + Module — same "one-time bulk
// setup problem" as the Employee importer (src/services/employee/employeeCsvService.ts),
// and deliberately mirrors its shape: reuse the shared CSV parser/escaper
// from src/services/quiz/quizCsvService.ts, resolve related entities by
// NAME/CODE against what already exists, write nothing until the admin has
// seen a full preview and clicked Confirm.
//
// One CSV row = one Module. Its Category and Course columns are repeated on
// every row that belongs to the same course (same shape as an employee row
// repeating its Branch/Department name) — the course itself is only
// actually created once per unique Course Code, using that code's first
// row for the course-level fields; every other row with the same code just
// contributes another module to it.
//
// Lesson/content and thumbnail are NOT part of this import — a module
// created this way has zero lessons and a course created this way has no
// thumbnail, both filled in afterward through the normal edit screens.
// Every course created here starts Draft (active: false) for exactly that
// reason — nothing becomes visible to employees until an admin reviews it.

import { parseCsv, csvEscape, downloadCsvFile } from "../quiz/quizCsvService";
import { createCategory } from "../category/categoryService";
import { createCourse } from "../course/courseService";
import { createModule } from "../module/moduleService";

import type { Category } from "../../types/category";
import type { Course, CourseLevel } from "../../types/course";
import type { Module } from "../../types/module";

const LEVELS: CourseLevel[] = ["beginner", "intermediate", "advanced"];

export const CSV_HEADERS = [
  "Category Name", "Course Code", "Course Name", "Course Short Description", "Level",
  "Duration Days", "Duration Hours", "Passing %",
  "Module Code", "Module Name", "Module Description", "Module Order", "Estimated Minutes (Timing)",
];

export const SAMPLE_ROWS: string[][] = [
  ["Sales Training", "CRS-SALES-101", "Real Estate Sales Fundamentals", "Learn the basics of real estate sales.", "beginner", "5", "10", "50", "MOD-101-01", "Introduction to Real Estate Sales", "Overview of the sales process end to end.", "1", "20"],
  ["Sales Training", "CRS-SALES-101", "Real Estate Sales Fundamentals", "Learn the basics of real estate sales.", "beginner", "5", "10", "50", "MOD-101-02", "Building Client Relationships", "How to build trust with a client.", "2", "25"],
  ["Compliance", "CRS-COMP-201", "RERA Compliance Essentials", "Understand RERA regulations for agents.", "intermediate", "2", "4", "60", "MOD-201-01", "Introduction to RERA", "What RERA is and why it matters.", "1", "15"],
];

export function buildTemplateCsv(): string {
  const lines = [CSV_HEADERS, ...SAMPLE_ROWS].map((row) => row.map(csvEscape).join(","));
  return lines.join("\r\n");
}

export function downloadTemplate(): void {
  downloadCsvFile("course-bulk-import-template.csv", buildTemplateCsv());
}

// ── Raw row shape straight off the CSV ──────────────────────────────────────

export interface CourseCsvRow {
  rowNum: number;
  category_name: string;
  course_code: string;
  course_name: string;
  course_short_description: string;
  level: string;
  duration_days: string;
  duration_hours: string;
  passing_percentage: string;
  module_code: string;
  module_name: string;
  module_description: string;
  module_order: string;
  estimated_minutes: string;
}

export function parseCoursesCsv(text: string): { rows: CourseCsvRow[]; parseErrors: string[] } {
  const parsed = parseCsv(text);
  if (parsed.length < 2) {
    return { rows: [], parseErrors: ["The file has no data rows (only a header, or is empty)."] };
  }

  const header = parsed[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const idx = {
    category: col("category name"),
    courseCode: col("course code"),
    courseName: col("course name"),
    courseDesc: col("course short description"),
    level: col("level"),
    durationDays: col("duration days"),
    durationHours: col("duration hours"),
    passing: col("passing %"),
    moduleCode: col("module code"),
    moduleName: col("module name"),
    moduleDesc: col("module description"),
    moduleOrder: col("module order"),
    minutes: col("estimated minutes (timing)"),
  };

  if (idx.category === -1 || idx.courseCode === -1 || idx.courseName === -1 || idx.moduleCode === -1 || idx.moduleName === -1 || idx.minutes === -1) {
    return {
      rows: [],
      parseErrors: ['The file must have at least "Category Name", "Course Code", "Course Name", "Module Code", "Module Name", and "Estimated Minutes (Timing)" columns.'],
    };
  }

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  const rows: CourseCsvRow[] = parsed.slice(1).map((r, i) => ({
    rowNum: i + 2,
    category_name: get(r, idx.category),
    course_code: get(r, idx.courseCode),
    course_name: get(r, idx.courseName),
    course_short_description: get(r, idx.courseDesc),
    level: get(r, idx.level),
    duration_days: get(r, idx.durationDays),
    duration_hours: get(r, idx.durationHours),
    passing_percentage: get(r, idx.passing),
    module_code: get(r, idx.moduleCode),
    module_name: get(r, idx.moduleName),
    module_description: get(r, idx.moduleDesc),
    module_order: get(r, idx.moduleOrder),
    estimated_minutes: get(r, idx.minutes),
  }));

  return { rows, parseErrors: [] };
}

// ── The import plan — resolves every row against existing + queued-new
// Category/Course, validates, and reports a per-row verdict WITHOUT writing
// anything. This is what the preview screen renders. ────────────────────────

const norm = (s: string) => s.trim().toLowerCase();

function parseNonNegativeInt(value: string, fallback: number): number | null {
  if (!value.trim()) return fallback;
  if (!/^\d+$/.test(value.trim())) return null;
  return Number(value.trim());
}

export type RowAction = "existing" | "create";

export interface PlannedCategory { key: string; name: string }

export interface PlannedCourse {
  key: string;
  course_code: string;
  course_name: string;
  short_description: string;
  level: CourseLevel;
  duration_days: number;
  duration_hours: number;
  passing_percentage: number;
  categoryKey: string;
}

export interface ResolvedRow {
  row: CourseCsvRow;
  valid: boolean;
  errors: string[];
  categoryAction: RowAction;
  courseAction: RowAction;
  categoryKey: string;
  courseKey: string;
  normalizedModuleOrder: number | null;
  normalizedEstimatedMinutes: number | null;
}

export interface ImportPlan {
  resolvedRows: ResolvedRow[];
  categoriesToCreate: PlannedCategory[];
  coursesToCreate: PlannedCourse[];
}

export function buildImportPlan(
  companyId: string,
  rows: CourseCsvRow[],
  existing: { categories: Category[]; courses: Course[]; modules: Module[] }
): ImportPlan {
  // Some legacy rows have a null course_code/module_code in the database
  // despite the column being typed as a plain string — tolerate that rather
  // than crashing the whole import plan over a handful of old test rows.
  const usedCourseCodes = new Set(existing.courses.map((c) => (c.course_code ?? "").toLowerCase()).filter(Boolean));
  const usedModuleCodes = new Set(existing.modules.map((m) => (m.module_code ?? "").toLowerCase()).filter(Boolean));
  const seenCourseCodesInFile = new Set<string>();
  const seenModuleCodesInFile = new Set<string>();

  // key -> planned entity, so every row repeating the same Category/Course
  // queues exactly one creation.
  const categoryPlan = new Map<string, PlannedCategory>();
  const coursePlan = new Map<string, PlannedCourse>();

  // Auto-numbers Module Order when left blank — one counter per course key,
  // incrementing in file order, so a course's modules land in the same
  // order they were listed without the admin having to number them by hand.
  const nextOrderByCourseKey = new Map<string, number>();

  function resolveCategory(name: string): { key: string; action: RowAction } {
    const key = norm(name);
    const found = existing.categories.find((c) => c.company_id === companyId && norm(c.category_name) === key);
    if (found) return { key: found.id, action: "existing" };
    if (!categoryPlan.has(key)) categoryPlan.set(key, { key, name: name.trim() });
    return { key: `new:${key}`, action: "create" };
  }

  const resolvedRows: ResolvedRow[] = rows.map((row) => {
    const errors: string[] = [];

    if (!row.category_name) errors.push("Category Name is required.");
    if (!row.course_code) errors.push("Course Code is required.");
    if (!row.course_name) errors.push("Course Name is required.");
    if (!row.module_code) errors.push("Module Code is required.");
    if (!row.module_name) errors.push("Module Name is required.");

    let level: CourseLevel = "beginner";
    if (row.level) {
      const lower = row.level.trim().toLowerCase() as CourseLevel;
      if (!LEVELS.includes(lower)) errors.push(`Level "${row.level}" must be one of: beginner, intermediate, advanced.`);
      else level = lower;
    }

    const durationDays = parseNonNegativeInt(row.duration_days, 0);
    if (durationDays === null) errors.push(`Duration Days "${row.duration_days}" must be a whole number.`);

    const durationHours = parseNonNegativeInt(row.duration_hours, 0);
    if (durationHours === null) errors.push(`Duration Hours "${row.duration_hours}" must be a whole number.`);

    let passingPercentage = 50;
    if (row.passing_percentage.trim()) {
      const n = Number(row.passing_percentage.trim());
      if (!Number.isFinite(n) || n < 0 || n > 100) errors.push(`Passing % "${row.passing_percentage}" must be a number between 0 and 100.`);
      else passingPercentage = n;
    }

    const normalizedEstimatedMinutes = parseNonNegativeInt(row.estimated_minutes, 0);
    if (!row.estimated_minutes.trim()) errors.push("Estimated Minutes (Timing) is required.");
    else if (normalizedEstimatedMinutes === null || normalizedEstimatedMinutes < 1) errors.push(`Estimated Minutes "${row.estimated_minutes}" must be a whole number of at least 1.`);

    let normalizedModuleOrder: number | null = null;
    if (row.module_order.trim()) {
      const n = parseNonNegativeInt(row.module_order, 0);
      if (n === null || n < 1) errors.push(`Module Order "${row.module_order}" must be a whole number of at least 1.`);
      else normalizedModuleOrder = n;
    }

    if (row.course_code) {
      const codeLower = row.course_code.toLowerCase();
      if (usedCourseCodes.has(codeLower)) errors.push(`Course Code "${row.course_code}" already exists.`);
    }

    if (row.module_code) {
      const codeLower = row.module_code.toLowerCase();
      if (usedModuleCodes.has(codeLower)) errors.push(`Module Code "${row.module_code}" already exists.`);
      else if (seenModuleCodesInFile.has(codeLower)) errors.push(`Module Code "${row.module_code}" is duplicated elsewhere in this file.`);
      else seenModuleCodesInFile.add(codeLower);
    }

    let categoryRes: { key: string; action: RowAction } = { key: "", action: "existing" };
    if (row.category_name) categoryRes = resolveCategory(row.category_name);

    let courseRes: { key: string; action: RowAction } = { key: "", action: "existing" };
    if (row.course_code) {
      const codeKey = norm(row.course_code);
      const alreadyBad = usedCourseCodes.has(codeKey);
      if (!alreadyBad) {
        if (!seenCourseCodesInFile.has(codeKey)) {
          seenCourseCodesInFile.add(codeKey);
          coursePlan.set(codeKey, {
            key: codeKey,
            course_code: row.course_code.trim(),
            course_name: row.course_name.trim(),
            short_description: row.course_short_description.trim(),
            level,
            duration_days: durationDays ?? 0,
            duration_hours: durationHours ?? 0,
            passing_percentage: passingPercentage,
            categoryKey: categoryRes.key,
          });
        }
        courseRes = { key: `new:${codeKey}`, action: "create" };
      }
    }

    const courseCounterKey = courseRes.key || norm(row.course_code);
    if (normalizedModuleOrder !== null) {
      // An explicit order was given — bump the course's counter past it so
      // a LATER blank row in the same course continues after it, instead of
      // colliding with it (e.g. row 1 says order 1, row 2 is left blank —
      // row 2 must become 2, not restart its own count from 1).
      const current = nextOrderByCourseKey.get(courseCounterKey) ?? 0;
      if (normalizedModuleOrder > current) nextOrderByCourseKey.set(courseCounterKey, normalizedModuleOrder);
    } else if (!errors.some((e) => e.startsWith("Module Order"))) {
      const next = (nextOrderByCourseKey.get(courseCounterKey) ?? 0) + 1;
      nextOrderByCourseKey.set(courseCounterKey, next);
      normalizedModuleOrder = next;
    }

    return {
      row,
      valid: errors.length === 0,
      errors,
      categoryAction: categoryRes.action,
      courseAction: courseRes.action,
      categoryKey: categoryRes.key,
      courseKey: courseRes.key,
      normalizedModuleOrder,
      normalizedEstimatedMinutes,
    };
  });

  return {
    resolvedRows,
    categoriesToCreate: Array.from(categoryPlan.values()),
    coursesToCreate: Array.from(coursePlan.values()),
  };
}

// ── Commit — only called after the admin has seen the plan and confirmed ───

export interface ImportResult {
  createdCategories: number;
  createdCourses: number;
  createdModules: number;
  failedRows: { rowNum: number; module_code: string; reason: string }[];
  structureErrors: string[];
}

export async function commitImport(companyId: string, plan: ImportPlan): Promise<ImportResult> {
  const result: ImportResult = {
    createdCategories: 0, createdCourses: 0, createdModules: 0,
    failedRows: [], structureErrors: [],
  };

  // Categories first (no dependency), then courses (need real category
  // ids), then modules (need real course ids) — same "resolve new:xxx keys
  // to real ids as we go, individually try/caught" shape as the employee
  // importer, so one bad structural row can't abort the entire import.
  const categoryKeyToId = new Map<string, string>();
  for (const c of plan.categoriesToCreate) {
    try {
      const created = await createCategory({ company_id: companyId, category_name: c.name, description: "", icon: "", display_order: 0, active: true });
      categoryKeyToId.set(`new:${c.key}`, created.id);
      result.createdCategories++;
    } catch (e) {
      result.structureErrors.push(`Category "${c.name}" could not be created: ${e instanceof Error ? e.message : "unknown error"}.`);
    }
  }

  function resolveCategoryId(key: string): string {
    return key.startsWith("new:") ? (categoryKeyToId.get(key) ?? "") : key;
  }

  const courseKeyToId = new Map<string, string>();
  for (const c of plan.coursesToCreate) {
    try {
      const categoryId = resolveCategoryId(c.categoryKey);
      const created = await createCourse({
        company_id: companyId,
        category_id: categoryId,
        course_code: c.course_code,
        course_name: c.course_name,
        short_description: c.short_description,
        full_description: "",
        thumbnail: "",
        level: c.level,
        duration_days: c.duration_days,
        duration_hours: c.duration_hours,
        passing_percentage: c.passing_percentage,
        certificate_enabled: false,
        require_completion_before_next: false,
        test_compulsory_after_module: false,
        watermark_enabled: false,
        watermark_text: null,
        display_order: 0,
        // Draft until an admin has added content/thumbnail and reviewed it —
        // never visible to employees straight out of a CSV import.
        active: false,
        created_by: "",
      });
      courseKeyToId.set(`new:${c.key}`, created.id);
      result.createdCourses++;
    } catch (e) {
      result.structureErrors.push(`Course "${c.course_name}" (${c.course_code}) could not be created: ${e instanceof Error ? e.message : "unknown error"}.`);
    }
  }

  function resolveCourseId(key: string): string {
    return key.startsWith("new:") ? (courseKeyToId.get(key) ?? "") : key;
  }

  for (const r of plan.resolvedRows) {
    if (!r.valid) {
      result.failedRows.push({ rowNum: r.row.rowNum, module_code: r.row.module_code, reason: r.errors.join(" ") });
      continue;
    }
    const courseId = resolveCourseId(r.courseKey);
    if (!courseId) {
      result.failedRows.push({
        rowNum: r.row.rowNum,
        module_code: r.row.module_code,
        reason: "Skipped — its Course failed to be created (see the errors above).",
      });
      continue;
    }

    try {
      await createModule({
        course_id: courseId,
        module_code: r.row.module_code,
        module_name: r.row.module_name,
        description: r.row.module_description,
        module_order: r.normalizedModuleOrder ?? 1,
        estimated_minutes: r.normalizedEstimatedMinutes ?? 1,
        thumbnail: "",
        active: true,
      });
      result.createdModules++;
    } catch (e) {
      result.failedRows.push({ rowNum: r.row.rowNum, module_code: r.row.module_code, reason: e instanceof Error ? e.message : "Failed to create." });
    }
  }

  return result;
}

export function downloadFailedRowsCsv(failedRows: ImportResult["failedRows"]): void {
  const rows = [["Row", "Module Code", "Reason"], ...failedRows.map((f) => [String(f.rowNum), f.module_code, f.reason])];
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  downloadCsvFile("course-bulk-import-errors.csv", csv);
}
