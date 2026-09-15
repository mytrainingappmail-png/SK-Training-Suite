// src/services/employee/employeeCsvService.ts
//
// Bulk CSV employee import — the one-time "client already has 20-100
// employees" onboarding problem. Reuses the exact same generic CSV
// parser/escaper/downloader already used for quiz-question bulk import
// (src/services/quiz/quizCsvService.ts) rather than inventing a second one.
//
// Branch/Department/Designation are resolved by NAME (case-insensitive,
// trimmed) against what the company already has — a match reuses the
// existing row, a miss queues a new one to create. Nothing is written to
// the database until the admin has seen a full preview and clicked
// Confirm — this mirrors the same "reject and report, never guess" spirit
// as the quiz importer's own header comment.

import { parseCsv, csvEscape, downloadCsvFile } from "../quiz/quizCsvService";
import { branchService } from "../branch/branchService";
import { departmentService } from "../department/departmentService";
import { designationService } from "../designation/designationService";
import { employeeService } from "../employee/employeeService";
import { generateTemporaryPassword } from "../../utils/passwordGenerator";

import type { Employee, EmployeeForm } from "../../types/employee";
import type { Branch } from "../../types/branch";
import type { Department } from "../../types/department";
import type { Designation } from "../../types/designation";

export const CSV_HEADERS = [
  "Employee Code", "First Name", "Last Name", "Mobile", "Email",
  "Branch", "Department", "Designation", "Joining Date",
  "Reporting Manager Code", "Password",
];

export const SAMPLE_ROWS: string[][] = [
  ["EMP-201", "Rahul", "Sharma", "9876543210", "rahul.sharma@example.com", "Gurgaon", "Sales", "Sales Executive", "2026-01-15", "", ""],
  ["EMP-202", "Priya", "Nair", "9876543211", "priya.nair@example.com", "Gurgaon", "Sales", "Sales Manager", "2026-01-15", "EMP-201", ""],
];

export function buildTemplateCsv(): string {
  const lines = [CSV_HEADERS, ...SAMPLE_ROWS].map((row) => row.map(csvEscape).join(","));
  return lines.join("\r\n");
}

export function downloadTemplate(): void {
  downloadCsvFile("employee-bulk-import-template.csv", buildTemplateCsv());
}

// ── Raw row shape straight off the CSV ──────────────────────────────────────

export interface EmployeeCsvRow {
  rowNum: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  branch_name: string;
  department_name: string;
  designation_name: string;
  joining_date: string;
  reporting_manager_code: string;
  password: string;
}

export function parseEmployeesCsv(text: string): { rows: EmployeeCsvRow[]; parseErrors: string[] } {
  const parsed = parseCsv(text);
  if (parsed.length < 2) {
    return { rows: [], parseErrors: ["The file has no data rows (only a header, or is empty)."] };
  }

  const header = parsed[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const idx = {
    code: col("employee code"),
    first: col("first name"),
    last: col("last name"),
    mobile: col("mobile"),
    email: col("email"),
    branch: col("branch"),
    dept: col("department"),
    desig: col("designation"),
    joining: col("joining date"),
    manager: col("reporting manager code"),
    password: col("password"),
  };

  if (idx.code === -1 || idx.first === -1 || idx.branch === -1 || idx.dept === -1 || idx.desig === -1 || idx.joining === -1) {
    return {
      rows: [],
      parseErrors: ['The file must have at least "Employee Code", "First Name", "Branch", "Department", "Designation", and "Joining Date" columns.'],
    };
  }

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  const rows: EmployeeCsvRow[] = parsed.slice(1).map((r, i) => ({
    rowNum: i + 2,
    employee_code: get(r, idx.code),
    first_name: get(r, idx.first),
    last_name: get(r, idx.last),
    mobile: get(r, idx.mobile),
    email: get(r, idx.email),
    branch_name: get(r, idx.branch),
    department_name: get(r, idx.dept),
    designation_name: get(r, idx.desig),
    joining_date: get(r, idx.joining),
    reporting_manager_code: get(r, idx.manager),
    password: get(r, idx.password),
  }));

  return { rows, parseErrors: [] };
}

// ── Date parsing — accepts the template's own yyyy-mm-dd, plus the
// dd/mm/yyyy and dd-mm-yyyy formats a spreadsheet is likely to produce ──────

export function parseFlexibleDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return v;

  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const day = dd.padStart(2, "0");
    const month = mm.padStart(2, "0");
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${yyyy}-${month}-${day}`;
    }
  }

  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

// ── Code synthesis for an auto-created Branch/Department/Designation ────────
// Codes are required everywhere but never auto-generated by the backend
// today (confirmed: no DB default/sequence) — so a bulk import that only
// gives us a NAME has to invent one. Slugified from the name, deduped
// against everything already used (existing + already-queued-this-import).

function slugifyCode(name: string, used: Set<string>): string {
  let base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20);
  if (!base) base = "ROW";
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}-${n}`.slice(0, 24);
    n++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

// ── The import plan — resolves every row against existing + queued-new
// Branch/Department/Designation, validates, and reports a per-row verdict
// WITHOUT writing anything. This is what the preview screen renders. ────────

export type RowAction = "existing" | "create";

export interface PlannedEntity { key: string; name: string; code: string }

export interface ResolvedRow {
  row: EmployeeCsvRow;
  valid: boolean;
  errors: string[];
  branchAction: RowAction;
  departmentAction: RowAction;
  designationAction: RowAction;
  branchKey: string;
  departmentKey: string;
  designationKey: string;
  normalizedJoiningDate: string | null;
}

export interface ImportPlan {
  resolvedRows: ResolvedRow[];
  branchesToCreate: PlannedEntity[];
  departmentsToCreate: (PlannedEntity & { branchKey: string })[];
  designationsToCreate: (PlannedEntity & { departmentKey: string; branchKey: string })[];
}

const norm = (s: string) => s.trim().toLowerCase();

export function buildImportPlan(
  companyId: string,
  rows: EmployeeCsvRow[],
  existing: { branches: Branch[]; departments: Department[]; designations: Designation[]; employees: Employee[] }
): ImportPlan {
  const usedBranchCodes = new Set(existing.branches.map((b) => b.branch_code.toLowerCase()));
  const usedDeptCodes = new Set(existing.departments.map((d) => d.department_code.toLowerCase()));
  const usedDesigCodes = new Set(existing.designations.map((d) => d.designation_code.toLowerCase()));
  const usedEmployeeCodes = new Set(existing.employees.filter((e) => e.company_id === companyId).map((e) => e.employee_code.toLowerCase()));
  const seenEmployeeCodesInFile = new Set<string>();

  // key -> planned entity, so 20 rows all saying "Mohali" queue exactly one new Branch
  const branchPlan = new Map<string, PlannedEntity>();
  const deptPlan = new Map<string, PlannedEntity & { branchKey: string }>();
  const desigPlan = new Map<string, PlannedEntity & { departmentKey: string; branchKey: string }>();

  function resolveBranch(name: string): { key: string; action: RowAction } {
    const key = norm(name);
    const found = existing.branches.find((b) => b.company_id === companyId && norm(b.branch_name) === key);
    if (found) return { key: found.id, action: "existing" };
    if (!branchPlan.has(key)) {
      branchPlan.set(key, { key, name: name.trim(), code: slugifyCode(name, usedBranchCodes) });
    }
    return { key: `new:${key}`, action: "create" };
  }

  function resolveDepartment(name: string, branchKey: string): { key: string; action: RowAction } {
    const deptKey = `${branchKey}::${norm(name)}`;
    if (!branchKey.startsWith("new:")) {
      const found = existing.departments.find((d) => d.branch_id === branchKey && norm(d.department_name) === norm(name));
      if (found) return { key: found.id, action: "existing" };
    }
    if (!deptPlan.has(deptKey)) {
      deptPlan.set(deptKey, { key: deptKey, name: name.trim(), code: slugifyCode(name, usedDeptCodes), branchKey });
    }
    return { key: `new:${deptKey}`, action: "create" };
  }

  function resolveDesignation(name: string, departmentKey: string, branchKey: string, level: number): { key: string; action: RowAction } {
    const desigKey = `${departmentKey}::${norm(name)}`;
    if (!departmentKey.startsWith("new:")) {
      const found = existing.designations.find((d) => d.department_id === departmentKey && norm(d.designation_name) === norm(name));
      if (found) return { key: found.id, action: "existing" };
    }
    if (!desigPlan.has(desigKey)) {
      desigPlan.set(desigKey, { key: desigKey, name: name.trim(), code: slugifyCode(name, usedDesigCodes), departmentKey, branchKey });
    }
    void level;
    return { key: `new:${desigKey}`, action: "create" };
  }

  const resolvedRows: ResolvedRow[] = rows.map((row) => {
    const errors: string[] = [];

    if (!row.employee_code) errors.push("Employee Code is required.");
    if (!row.first_name) errors.push("First Name is required.");
    if (!row.branch_name) errors.push("Branch is required.");
    if (!row.department_name) errors.push("Department is required.");
    if (!row.designation_name) errors.push("Designation is required.");

    const normalizedJoiningDate = row.joining_date ? parseFlexibleDate(row.joining_date) : null;
    if (!row.joining_date) errors.push("Joining Date is required.");
    else if (!normalizedJoiningDate) errors.push(`Joining Date "${row.joining_date}" isn't a recognizable date.`);

    if (row.employee_code) {
      const codeLower = row.employee_code.toLowerCase();
      if (usedEmployeeCodes.has(codeLower)) errors.push(`Employee Code "${row.employee_code}" already exists.`);
      else if (seenEmployeeCodesInFile.has(codeLower)) errors.push(`Employee Code "${row.employee_code}" is duplicated elsewhere in this file.`);
      else seenEmployeeCodesInFile.add(codeLower);
    }

    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push(`Email "${row.email}" isn't valid.`);
    if (row.mobile && !/^[+]?[\d\s\-().]{7,20}$/.test(row.mobile)) errors.push(`Mobile "${row.mobile}" isn't valid.`);
    if (row.password && row.password.length < 6) errors.push("Password must be at least 6 characters (or leave blank to auto-generate).");

    let branchRes: { key: string; action: RowAction } = { key: "", action: "existing" };
    let deptRes: { key: string; action: RowAction } = { key: "", action: "existing" };
    let desigRes: { key: string; action: RowAction } = { key: "", action: "existing" };

    if (row.branch_name) branchRes = resolveBranch(row.branch_name);
    if (row.department_name && branchRes.key) deptRes = resolveDepartment(row.department_name, branchRes.key);
    if (row.designation_name && deptRes.key) desigRes = resolveDesignation(row.designation_name, deptRes.key, branchRes.key, 1);

    return {
      row,
      valid: errors.length === 0,
      errors,
      branchAction: branchRes.action,
      departmentAction: deptRes.action,
      designationAction: desigRes.action,
      branchKey: branchRes.key,
      departmentKey: deptRes.key,
      designationKey: desigRes.key,
      normalizedJoiningDate,
    };
  });

  return {
    resolvedRows,
    branchesToCreate: Array.from(branchPlan.values()),
    departmentsToCreate: Array.from(deptPlan.values()),
    designationsToCreate: Array.from(desigPlan.values()),
  };
}

// ── Commit — only called after the admin has seen the plan and confirmed ───

export interface ImportResult {
  createdEmployees: number;
  createdBranches: number;
  createdDepartments: number;
  createdDesignations: number;
  failedRows: { rowNum: number; employee_code: string; reason: string }[];
  managerLinkWarnings: string[];
  generatedPasswords: { employee_code: string; password: string }[];
  structureErrors: string[];
}

export async function commitImport(companyId: string, plan: ImportPlan): Promise<ImportResult> {
  const result: ImportResult = {
    createdEmployees: 0, createdBranches: 0, createdDepartments: 0, createdDesignations: 0,
    failedRows: [], managerLinkWarnings: [], generatedPasswords: [], structureErrors: [],
  };

  // Branches first (no dependency), then departments (need real branch ids),
  // then designations (need real branch+department ids) — resolving each
  // "new:xxx" key to the real created row id as we go. Each creation is
  // individually try/caught (e.g. a duplicate branch code) so one bad
  // structural row can't abort the entire import — any employee row that
  // depended on it will fail its own create below (missing id) and land in
  // failedRows instead, and the admin sees exactly what happened rather
  // than the modal hanging on the "importing" spinner forever.
  const branchKeyToId = new Map<string, string>();
  for (const b of plan.branchesToCreate) {
    try {
      const created = await branchService.create({ company_id: companyId, branch_name: b.name, branch_code: b.code, active: true });
      branchKeyToId.set(`new:${b.key}`, created.id);
      result.createdBranches++;
    } catch (e) {
      result.structureErrors.push(`Branch "${b.name}" (${b.code}) could not be created: ${e instanceof Error ? e.message : "unknown error"}.`);
    }
  }

  function resolveBranchId(key: string): string {
    return key.startsWith("new:") ? (branchKeyToId.get(key) ?? "") : key;
  }

  const deptKeyToId = new Map<string, string>();
  for (const d of plan.departmentsToCreate) {
    try {
      const branchId = resolveBranchId(d.branchKey);
      const created = await departmentService.create({ company_id: companyId, branch_id: branchId, department_name: d.name, department_code: d.code, active: true });
      deptKeyToId.set(`new:${d.key}`, created.id);
      result.createdDepartments++;
    } catch (e) {
      result.structureErrors.push(`Department "${d.name}" (${d.code}) could not be created: ${e instanceof Error ? e.message : "unknown error"}.`);
    }
  }

  function resolveDeptId(key: string): string {
    return key.startsWith("new:") ? (deptKeyToId.get(key) ?? "") : key;
  }

  const desigKeyToId = new Map<string, string>();
  for (const d of plan.designationsToCreate) {
    try {
      const branchId = resolveBranchId(d.branchKey);
      const departmentId = resolveDeptId(d.departmentKey);
      const created = await designationService.create({
        company_id: companyId, branch_id: branchId, department_id: departmentId,
        designation_name: d.name, designation_code: d.code, hierarchy_level: 1, active: true,
      });
      desigKeyToId.set(`new:${d.key}`, created.id);
      result.createdDesignations++;
    } catch (e) {
      result.structureErrors.push(`Designation "${d.name}" (${d.code}) could not be created: ${e instanceof Error ? e.message : "unknown error"}.`);
    }
  }

  function resolveDesigId(key: string): string {
    return key.startsWith("new:") ? (desigKeyToId.get(key) ?? "") : key;
  }

  // Employees — second pass resolves Reporting Manager by employee code
  // once everyone in this batch actually has an id.
  const codeToNewEmployeeId = new Map<string, string>();
  const createdForManagerLinking: { id: string; managerCode: string; form: EmployeeForm }[] = [];

  for (const r of plan.resolvedRows) {
    if (!r.valid) {
      result.failedRows.push({ rowNum: r.row.rowNum, employee_code: r.row.employee_code, reason: r.errors.join(" ") });
      continue;
    }
    const branchId = resolveBranchId(r.branchKey);
    const departmentId = resolveDeptId(r.departmentKey);
    const designationId = resolveDesigId(r.designationKey);
    if (!branchId || !departmentId || !designationId) {
      result.failedRows.push({
        rowNum: r.row.rowNum,
        employee_code: r.row.employee_code,
        reason: "Skipped — its Branch/Department/Designation failed to be created (see the errors above).",
      });
      continue;
    }
    const password = r.row.password || generateTemporaryPassword();

    const form: EmployeeForm = {
      company_id: companyId,
      branch_id: branchId,
      department_id: departmentId,
      designation_id: designationId,
      employee_code: r.row.employee_code,
      first_name: r.row.first_name,
      last_name: r.row.last_name,
      mobile: r.row.mobile,
      email: r.row.email,
      joining_date: r.normalizedJoiningDate ?? "",
      reporting_manager: null,
      active: true,
      attendance_location_scope: "all",
      password,
    };

    try {
      const created = await employeeService.create(form);
      result.createdEmployees++;
      result.generatedPasswords.push({ employee_code: r.row.employee_code, password });
      codeToNewEmployeeId.set(r.row.employee_code.toLowerCase(), created.id);
      if (r.row.reporting_manager_code) createdForManagerLinking.push({ id: created.id, managerCode: r.row.reporting_manager_code, form });
    } catch (e) {
      result.failedRows.push({ rowNum: r.row.rowNum, employee_code: r.row.employee_code, reason: e instanceof Error ? e.message : "Failed to create." });
    }
  }

  // Link reporting managers — resolve against employees created in THIS
  // batch first, falling back to whatever was already in the company.
  if (createdForManagerLinking.length > 0) {
    const existingByCode = new Map<string, Employee>();
    // populated lazily only if needed, since most imports won't reference
    // a manager who already existed before this import
    let existingEmployeesCache: Employee[] | null = null;

    for (const link of createdForManagerLinking) {
      const codeLower = link.managerCode.toLowerCase();
      let managerId = codeToNewEmployeeId.get(codeLower);
      if (!managerId) {
        if (!existingEmployeesCache) existingEmployeesCache = await employeeService.getAll();
        for (const e of existingEmployeesCache) existingByCode.set(e.employee_code.toLowerCase(), e);
        managerId = existingByCode.get(codeLower)?.id;
      }
      if (managerId) {
        try {
          await employeeService.update(link.id, { ...link.form, reporting_manager: managerId });
        } catch {
          result.managerLinkWarnings.push(`Could not link reporting manager "${link.managerCode}" for employee id ${link.id}.`);
        }
      } else {
        result.managerLinkWarnings.push(`Reporting Manager Code "${link.managerCode}" didn't match any employee — left unset.`);
      }
    }
  }

  return result;
}

export function downloadFailedRowsCsv(failedRows: ImportResult["failedRows"]): void {
  const rows = [["Row", "Employee Code", "Reason"], ...failedRows.map((f) => [String(f.rowNum), f.employee_code, f.reason])];
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  downloadCsvFile("employee-bulk-import-errors.csv", csv);
}

export function downloadGeneratedPasswordsCsv(passwords: ImportResult["generatedPasswords"]): void {
  const rows = [["Employee Code", "Password"], ...passwords.map((p) => [p.employee_code, p.password])];
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  downloadCsvFile("employee-bulk-import-passwords.csv", csv);
}
