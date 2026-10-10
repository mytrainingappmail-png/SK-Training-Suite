import { useEffect, useMemo, useState } from "react";
import { getExamResults } from "../../repositories/exam/examAdminRepository";
import { listFinalFeedback, saveFinalFeedback, createFinalUpload, deleteFinalUpload } from "../../repositories/quiz/quizFinalResultRepository";
import type { FolderExamSession } from "../../repositories/quiz/quizResultFolderRepository";
import {
  buildCandidates,
  downloadFinalReportXlsx,
  resultOf,
  sortRounds,
  type ReportRound,
} from "../../services/quiz/quizFinalReportService";
import FinalExcelUploadModal from "./FinalExcelUploadModal";
import type { QuizFinalResult, QuizFinalUpload } from "../../types/quiz";

interface Props {
  folder: { id: string; name: string };
  finals: QuizFinalResult[];
  exams: FolderExamSession[];
  uploads: QuizFinalUpload[];
  companyId: string;
  adminId: string | null;
  canEdit: boolean;
  onChanged: () => void;
}

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

/** Everything a folder holds — live quiz copies, exams and uploaded Excel rounds — merged per candidate into one
 * report with the trainer's feedback, downloadable as a single .xlsx. Rounds come from the folder's own contents. */
export default function FinalFolderReport({ folder, finals, exams, uploads, companyId, adminId, canEdit, onChanged }: Props) {
  const [showUpload, setShowUpload] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [examRounds, setExamRounds] = useState<ReportRound[]>([]);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [passInput, setPassInput] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  // exam sessions + feedback are only fetched when the report is opened
  const examKey = exams.map((e) => e.id).join(",");
  const wantKey = `${folder.id}|${examKey}`;
  const loading = showReport && loadedKey !== wantKey;
  useEffect(() => {
    if (!showReport) return;
    let cancelled = false;
    Promise.all([
      Promise.all(
        exams.map(async (x): Promise<ReportRound> => {
          const res = await getExamResults(x.id);
          return {
            key: `exam-${x.id}`,
            label: x.title,
            kind: "exam",
            date: day(x.finished_at ?? x.created_at),
            passPct: x.pass_pct,
            rows: res
              .filter((r) => r.submitted_at !== null)
              .map((r) => ({
                name: r.display_name,
                score: r.auto_marks + r.manual_marks,
                total: r.possible_marks,
                percent: r.possible_marks > 0 ? Math.round(((r.auto_marks + r.manual_marks) / r.possible_marks) * 1000) / 10 : null,
                correct: null,
                wrong: null,
                remarks: r.pending_written > 0 ? `${r.pending_written} written answer(s) not marked yet` : "",
              })),
          };
        })
      ),
      listFinalFeedback(folder.id),
    ])
      .then(([er, fb]) => {
        if (cancelled) return;
        setExamRounds(er);
        const m = Object.fromEntries(fb.map((f) => [f.candidate_key, f.feedback]));
        setFeedback(m);
        setSaved(m);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load the report."))
      .finally(() => !cancelled && setLoadedKey(wantKey));
    return () => { cancelled = true; };
  }, [showReport, folder.id, examKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const rounds = useMemo(() => {
    const quiz: ReportRound[] = finals.map((f) => ({
      key: `quiz-${f.id}`,
      label: f.quiz_title || "Live quiz",
      kind: "quiz",
      date: day(f.ended_at ?? f.saved_at),
      passPct: f.passing_score_pct,
      rows: f.rows.map((r) => ({
        name: r.display_name,
        // marks in a live quiz = correct answers (the quiz's own "score" is speed-weighted points)
        score: r.correct_count,
        total: r.total_questions,
        percent: r.percent_correct,
        correct: r.correct_count,
        wrong: r.total_questions - r.correct_count,
        remarks: "",
      })),
    }));
    const excel: ReportRound[] = uploads.map((u) => ({
      key: `xls-${u.id}`,
      label: u.round_label,
      kind: "excel",
      date: u.round_date ?? day(u.created_at),
      passPct: u.pass_pct,
      rows: u.rows,
    }));
    return sortRounds([...quiz, ...examRounds, ...excel]);
  }, [finals, examRounds, uploads]);

  const candidates = useMemo(() => buildCandidates(rounds), [rounds]);
  const passOverride = passInput.trim() !== "" && Number.isFinite(Number(passInput)) ? Number(passInput) : null;

  async function persistFeedback(key: string, name: string) {
    const text = (feedback[key] ?? "").trim();
    if (text === (saved[key] ?? "")) return;
    try {
      await saveFinalFeedback(companyId, folder.id, key, name, text);
      setSaved((s) => ({ ...s, [key]: text }));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the feedback.");
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const safe = folder.name.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "batch";
      await downloadFinalReportXlsx({ title: folder.name, rounds, candidates, feedback, passPct: passOverride }, `final-report-${safe}-${stamp}.xlsx`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the Excel file.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteUpload(u: QuizFinalUpload) {
    if (!confirm(`Remove the uploaded round “${u.round_label}” from this folder? Its ${u.rows.length} line(s) leave the combined report. This cannot be undone.`)) return;
    try {
      await deleteFinalUpload(u.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the round.");
    }
  }

  const roundCount = finals.length + exams.length + uploads.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowReport((v) => !v)}
          disabled={roundCount === 0}
          className="text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg px-3 py-1.5"
        >
          📊 {showReport ? "Hide" : "Combined report"} {roundCount > 0 && `(${roundCount} round${roundCount === 1 ? "" : "s"})`}
        </button>
        {canEdit && (
          <button
            onClick={() => setShowUpload(true)}
            className="text-xs font-semibold border border-violet-500/50 text-violet-200 hover:bg-violet-500/10 rounded-lg px-3 py-1.5"
          >
            📤 Upload Excel round
          </button>
        )}
      </div>

      {error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

      {uploads.map((u) => (
        <div key={u.id} className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-emerald-500/15 text-emerald-300">Excel</span>
          <div className="flex-1 min-w-0 text-sm text-white truncate">
            {u.round_label}
            <span className="text-xs text-slate-500 ml-2">
              {u.round_date ?? day(u.created_at)} · {u.rows.length} candidate{u.rows.length === 1 ? "" : "s"}
              {u.pass_pct !== null ? ` · pass ${u.pass_pct}%` : ""}
            </span>
          </div>
          {canEdit && (
            <button
              onClick={() => void handleDeleteUpload(u)}
              title="Remove this uploaded round"
              className="text-xs font-semibold text-red-300 hover:text-red-200 border border-red-900/50 rounded-lg px-2.5 py-1.5 shrink-0"
            >
              🗑
            </button>
          )}
        </div>
      ))}

      {showReport && (
        <div className="border border-slate-800 rounded-xl bg-slate-950/40 p-3 sm:p-4 space-y-3">
          {loading ? (
            <div className="text-sm text-slate-500">Building the report…</div>
          ) : candidates.length === 0 ? (
            <div className="text-sm text-slate-500">No candidates found in this folder's rounds yet.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[10rem]">
                  <div className="text-sm font-semibold text-white">Final report — {folder.name}</div>
                  <div className="text-xs text-slate-500">
                    {candidates.length} candidate{candidates.length === 1 ? "" : "s"} · {rounds.length} round{rounds.length === 1 ? "" : "s"} · matched by name
                  </div>
                </div>
                <label className="text-xs text-slate-400">
                  Pass mark %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={passInput}
                    onChange={(e) => setPassInput(e.target.value)}
                    placeholder="Each test's own"
                    className="mt-1 block w-32 rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-sm text-white outline-none focus:border-violet-500"
                  />
                </label>
                <button
                  onClick={() => void handleExport()}
                  disabled={exporting}
                  className="text-xs font-semibold bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-amber-950 rounded-lg px-3 py-2"
                >
                  {exporting ? "Preparing…" : "⬇ Download final report (Excel)"}
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 text-left">
                      <th className="px-2.5 py-2 w-10">#</th>
                      <th className="px-2.5 py-2 sticky left-0 bg-slate-900">Candidate</th>
                      {rounds.map((r) => (
                        <th key={r.key} className="px-2.5 py-2 whitespace-nowrap" title={r.date ?? undefined}>
                          {r.label}
                          <span className="block text-[10px] font-normal text-slate-500">{r.kind === "excel" ? "Excel" : r.kind === "exam" ? "Exam" : "Live quiz"} · %</span>
                        </th>
                      ))}
                      <th className="px-2.5 py-2">Best</th>
                      <th className="px-2.5 py-2">Avg</th>
                      <th className="px-2.5 py-2">Change</th>
                      <th className="px-2.5 py-2">Result</th>
                      <th className="px-2.5 py-2 min-w-[14rem]">Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => {
                      const res = resultOf(c, passOverride);
                      return (
                        <tr key={c.key} className="border-t border-slate-800 text-slate-200 align-top">
                          <td className="px-2.5 py-2 font-mono text-slate-500">{c.rank ?? "—"}</td>
                          <td className="px-2.5 py-2 font-semibold text-white sticky left-0 bg-slate-950">{c.name}</td>
                          {c.perRound.map((p, i) => (
                            <td key={i} className="px-2.5 py-2 font-mono">{p === null ? <span className="text-slate-600">—</span> : p.toFixed(1)}</td>
                          ))}
                          <td className="px-2.5 py-2 font-mono font-bold text-amber-300">{c.best === null ? "—" : c.best.toFixed(1)}</td>
                          <td className="px-2.5 py-2 font-mono">{c.average === null ? "—" : c.average.toFixed(1)}</td>
                          <td className={`px-2.5 py-2 font-mono ${c.change === null ? "text-slate-600" : c.change >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                            {c.change === null ? "—" : `${c.change > 0 ? "▲ +" : c.change < 0 ? "▼ " : ""}${c.change.toFixed(1)}`}
                          </td>
                          <td className="px-2.5 py-2">
                            {res ? (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${res === "Pass" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{res}</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-2.5 py-1.5">
                            {canEdit ? (
                              <textarea
                                rows={2}
                                value={feedback[c.key] ?? ""}
                                onChange={(e) => setFeedback((f) => ({ ...f, [c.key]: e.target.value }))}
                                onBlur={() => void persistFeedback(c.key, c.name)}
                                placeholder="Write feedback…"
                                className="w-full min-w-[14rem] rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-xs text-white outline-none focus:border-violet-500"
                              />
                            ) : (
                              <div className="whitespace-pre-wrap text-slate-300">{feedback[c.key] ?? ""}</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500">
                Feedback saves when you click away from the box. “Change” is the last round minus the first round for that person. The Excel file has this report on sheet 1 and every round line by line on sheet 2.
              </p>
            </>
          )}
        </div>
      )}

      {showUpload && (
        <FinalExcelUploadModal
          folderName={folder.name}
          onClose={() => setShowUpload(false)}
          onSave={async (input) => {
            await createFinalUpload(companyId, adminId, { folder_id: folder.id, ...input });
            setShowUpload(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
