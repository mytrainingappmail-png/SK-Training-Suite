// src/components/superadmin/CourseBulkImportModal.tsx
//
// Upload -> Preview -> Confirm -> Results. Same shape as
// EmployeeBulkImportModal.tsx. Nothing touches the database until the admin
// has seen the full preview (every row's verdict, every Category/Course
// that would get auto-created) and clicks Confirm Import.

import { useEffect, useRef, useState } from "react";
import {
  downloadTemplate, parseCoursesCsv, buildImportPlan, commitImport, downloadFailedRowsCsv,
} from "../../services/course/courseCsvService";
import { loadModules } from "../../services/module/moduleService";
import type { ImportPlan, ImportResult } from "../../services/course/courseCsvService";
import type { Category } from "../../types/category";
import type { Course } from "../../types/course";
import type { Module } from "../../types/module";
import type { Company } from "../../types/company";

type Step = "upload" | "preview" | "importing" | "results" | "error";

export default function CourseBulkImportModal({
  companies, categories, courses, onClose, onImported,
}: {
  companies: Company[];
  categories: Category[];
  courses: Course[];
  onClose: () => void;
  onImported: () => void;
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [modules, setModules] = useState<Module[] | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modules aren't already loaded by the parent Course Management screen
  // (they live under a separate Module Management tab) — fetched once here
  // instead, purely to check Module Code uniqueness against what already exists.
  useEffect(() => {
    loadModules().then(setModules).catch(() => setModules([]));
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId || !modules) return;
    setFileName(file.name);
    setParseError("");
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { rows, parseErrors } = parseCoursesCsv(text);
      if (parseErrors.length > 0) {
        setParseError(parseErrors[0]);
        return;
      }
      const builtPlan = buildImportPlan(companyId, rows, { categories, courses, modules });
      setPlan(builtPlan);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  async function handleConfirm() {
    if (!plan || !companyId) return;
    setStep("importing");
    try {
      const res = await commitImport(companyId, plan);
      setResult(res);
      setStep("results");
    } catch (e) {
      // commitImport can throw partway through — some rows may already be
      // saved at this point, so refresh the parent list (via onImported in
      // handleFinish) rather than pretending nothing happened.
      setImportError(e instanceof Error ? e.message : "The import stopped unexpectedly.");
      setStep("error");
    }
  }

  function handleFinish() {
    onImported();
    onClose();
  }

  const validCount = plan?.resolvedRows.filter((r) => r.valid).length ?? 0;
  const invalidCount = (plan?.resolvedRows.length ?? 0) - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={step !== "importing" ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Bulk Import Courses</h2>
            <p className="text-sm text-slate-500">One CSV upload — create Categories, Courses and Modules (with timing) at once. Add lesson content and a thumbnail afterward from each course's edit screen.</p>
          </div>
          {step !== "importing" && (
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {step === "upload" && (
            <div className="space-y-5">
              {companies.length > 1 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Company</label>
                  <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-700">1. Get the template</p>
                <p className="mb-3 text-sm text-slate-500">
                  One row = one Module. Repeat the same Category Name and Course Code on every row that belongs to the same course — the course itself is only created once (from that code's first row); every other row just adds another module to it.
                  Required: Category Name, Course Code, Course Name, Module Code, Module Name, Estimated Minutes (Timing). Everything else is optional — Level defaults to "beginner", Passing % to 50, Module Order auto-numbers in file order if left blank.
                </p>
                <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Download CSV Template (with sample rows filled in)
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-700">2. Upload the filled-in file</p>
                <p className="mb-3 text-sm text-slate-500">A Category name that doesn't exist yet will be created automatically. Every course created this way starts as <strong>Draft</strong> — it won't show to employees until you add its content/thumbnail and publish it.</p>
                <input
                  ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} disabled={!companyId || !modules}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
                />
                {!modules && <p className="mt-2 text-xs text-slate-400">Loading existing modules…</p>}
                {fileName && <p className="mt-2 text-xs text-slate-400">{fileName}</p>}
                {parseError && <p className="mt-2 text-sm text-rose-600">{parseError}</p>}
              </div>
            </div>
          )}

          {step === "preview" && plan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryStat label="Will import" value={validCount} tone="emerald" />
                <SummaryStat label="Row errors" value={invalidCount} tone="rose" />
                <SummaryStat label="New Categories" value={plan.categoriesToCreate.length} tone="amber" />
                <SummaryStat label="New Courses" value={plan.coursesToCreate.length} tone="amber" />
              </div>

              {(plan.categoriesToCreate.length > 0 || plan.coursesToCreate.length > 0) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="mb-1 font-semibold">These will be created automatically (as Draft courses):</p>
                  <ul className="list-inside list-disc space-y-0.5">
                    {plan.categoriesToCreate.map((c) => <li key={c.key}>Category — {c.name}</li>)}
                    {plan.coursesToCreate.map((c) => <li key={c.key}>Course — {c.course_name} ({c.course_code})</li>)}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Row", "Category", "Course", "Module Code", "Module Name", "Timing", "Status"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {plan.resolvedRows.map((r) => (
                      <tr key={r.row.rowNum} className={r.valid ? "" : "bg-rose-50/50"}>
                        <td className="px-3 py-2 text-slate-400">{r.row.rowNum}</td>
                        <td className="px-3 py-2">{r.row.category_name || "—"} {r.categoryAction === "create" && <span className="text-[10px] font-semibold text-amber-600">NEW</span>}</td>
                        <td className="px-3 py-2">{r.row.course_code || "—"} {r.courseAction === "create" && <span className="text-[10px] font-semibold text-amber-600">NEW</span>}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.row.module_code || "—"}</td>
                        <td className="px-3 py-2">{r.row.module_name || "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{r.normalizedEstimatedMinutes ?? "—"} min</td>
                        <td className="px-3 py-2">
                          {r.valid
                            ? <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Will import</span>
                            : <span className="text-xs text-rose-600" title={r.errors.join(" ")}>{r.errors[0]}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <svg className="h-8 w-8 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              <p className="text-sm text-slate-500">Importing — this can take a moment for a large file, please don't close this window.</p>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <svg className="h-10 w-10 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
              <p className="text-sm font-semibold text-slate-800">The import stopped partway through</p>
              <p className="max-w-md text-sm text-slate-500">{importError}</p>
              <p className="max-w-md text-xs text-slate-400">Some rows may already have been saved before this happened — check the Course/Category lists, then re-upload a CSV with only the remaining rows if needed.</p>
            </div>
          )}

          {step === "results" && result && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <SummaryStat label="Categories created" value={result.createdCategories} tone="amber" />
                <SummaryStat label="Courses created" value={result.createdCourses} tone="amber" />
                <SummaryStat label="Modules created" value={result.createdModules} tone="emerald" />
              </div>

              {result.structureErrors.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <p className="mb-1 font-semibold">{result.structureErrors.length} Category/Course couldn't be created:</p>
                  <ul className="list-inside list-disc space-y-0.5">
                    {result.structureErrors.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {result.failedRows.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-rose-800">{result.failedRows.length} row(s) were skipped.</p>
                  <button onClick={() => downloadFailedRowsCsv(result.failedRows)} className="rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                    Download Error Rows CSV
                  </button>
                </div>
              )}

              {result.createdCourses > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Every course created here is a <strong>Draft</strong> — open it from the Course list to add its thumbnail and mark it Active once you've added content to its modules.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          {step === "upload" && <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>}
          {step === "preview" && (
            <>
              <button onClick={() => { setStep("upload"); setPlan(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</button>
              <button onClick={handleConfirm} disabled={validCount === 0} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                Confirm Import ({validCount})
              </button>
            </>
          )}
          {step === "results" && <button onClick={handleFinish} className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">Done</button>}
          {step === "error" && <button onClick={handleFinish} className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">Close</button>}
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: "emerald" | "rose" | "amber" }) {
  const cls = { emerald: "text-emerald-600", rose: "text-rose-600", amber: "text-amber-600" }[tone];
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-xl font-bold ${cls}`}>{value}</p>
    </div>
  );
}
