import { useMemo, useState } from "react";
import {
  detectAll,
  readWorkbook,
  rebuildAttemptRows,
  suggestMapping,
  type DetectedFeedback,
  type DetectedRound,
  type RawSheet,
  type ValueMode,
} from "../../services/quiz/finalExcelImport";
import { mapRows, type ColumnMapping, type MappingField } from "../../services/quiz/quizFinalReportService";
import type { FinalUploadRow } from "../../types/quiz";

export interface UploadPayload {
  rounds: { round_label: string; file_name: string; pass_pct: number | null; round_date: string | null; rows: FinalUploadRow[] }[];
  feedback: DetectedFeedback[];
  overwriteFeedback: boolean;
}

interface Props {
  folderName: string;
  /** Round names already in this folder — a round with the same name is left unticked so it is not added twice. */
  existingLabels: string[];
  onClose: () => void;
  onSave: (payload: UploadPayload) => Promise<void>;
}

interface UiRound extends DetectedRound {
  include: boolean;
  passPct: string;
}

const MODE_LABEL: Record<ValueMode, string> = {
  percent: "a percent (e.g. 91)",
  fraction: "a fraction (e.g. 0.91)",
  marks: "marks out of the total",
};

const MANUAL_FIELDS: { key: MappingField; label: string; required?: boolean }[] = [
  { key: "name", label: "Candidate name", required: true },
  { key: "score", label: "Marks obtained" },
  { key: "total", label: "Out of (total marks)" },
  { key: "percent", label: "Percent" },
  { key: "remarks", label: "Remarks" },
];

const input = "w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500";

const cell = (v: unknown) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

/** Bring results in from ANY Excel / CSV file: the app finds the tables, names, marks, attempts and feedback itself,
 * shows what it found, and only saves what the trainer leaves ticked. */
export default function FinalExcelUploadModal({ folderName, existingLabels, onClose, onSave }: Props) {
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<RawSheet[]>([]);
  const [rounds, setRounds] = useState<UiRound[]>([]);
  const [feedback, setFeedback] = useState<DetectedFeedback[]>([]);
  const [includeFeedback, setIncludeFeedback] = useState(true);
  const [overwriteFeedback, setOverwriteFeedback] = useState(false);
  const [skipped, setSkipped] = useState<{ where: string; reason: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // "pick a table by hand"
  const [showManual, setShowManual] = useState(false);
  const [mSheet, setMSheet] = useState(0);
  const [mHeaderRow, setMHeaderRow] = useState("1");
  const [mMapping, setMMapping] = useState<ColumnMapping | null>(null);
  const [mTotal, setMTotal] = useState("");

  const taken = useMemo(() => new Set(existingLabels.map((l) => l.trim().toLowerCase())), [existingLabels]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setError("Please choose an Excel file saved as .xlsx (or a .csv). An older .xls file: open it in Excel and use File → Save As → Excel Workbook.");
      return;
    }
    try {
      const wb = await readWorkbook(file);
      const found = detectAll(wb);
      setSheets(wb);
      setFileName(file.name);
      setRounds(found.rounds.map((r) => {
        const dup = taken.has(r.label.trim().toLowerCase());
        const hasMarks = r.rows.some((x) => x.percent !== null);
        return { ...r, include: !dup && hasMarks, passPct: "" };
      }));
      setFeedback(found.feedback);
      setSkipped(found.skipped);
      setIncludeFeedback(found.feedback.length > 0);
      setLoaded(true);
      setShowManual(found.rounds.length === 0);
      setMSheet(0);
      setMMapping(null);
    } catch {
      setError("Could not read this file. Please save it again as a normal .xlsx workbook and retry.");
    }
  }

  function patch(id: string, p: Partial<UiRound>) {
    setRounds((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  function changeMode(r: UiRound, mode: ValueMode) {
    if (!r.attempt) return;
    const attempt = { ...r.attempt, mode };
    patch(r.id, { attempt, rows: rebuildAttemptRows(attempt, mode, new Map()) });
  }

  // ── manual table ──
  const manualSheet = sheets[mSheet];
  const manualHeaders = useMemo(() => {
    const row = manualSheet?.data[Math.max(0, (Number(mHeaderRow) || 1) - 1)] ?? [];
    return row.map((c, i) => cell(c) || `Column ${i + 1}`);
  }, [manualSheet, mHeaderRow]);

  function startManual(sheetIndex: number, headerRow: string) {
    setMSheet(sheetIndex);
    setMHeaderRow(headerRow);
    const row = sheets[sheetIndex]?.data[Math.max(0, (Number(headerRow) || 1) - 1)] ?? [];
    setMMapping(suggestMapping(row.map((c, i) => cell(c) || `Column ${i + 1}`)));
  }

  function addManual() {
    if (!manualSheet || !mMapping || mMapping.name === null) return;
    const body = manualSheet.data.slice(Number(mHeaderRow) || 1).filter((r) => r.some((c) => cell(c) !== ""));
    const t = Number(mTotal);
    const rows = mapRows(body, mMapping, mTotal.trim() !== "" && Number.isFinite(t) && t > 0 ? t : null);
    if (rows.length === 0) { setError("No candidate lines were found under that header row."); return; }
    setError("");
    setRounds((rs) => [...rs, {
      id: `manual-${Date.now()}`, label: manualSheet.name, date: "", source: `${manualSheet.name} · picked by hand`,
      kind: "main", rows, include: true, passPct: "",
    }]);
    setShowManual(false);
  }

  const chosen = rounds.filter((r) => r.include);
  const feedbackCount = includeFeedback ? feedback.length : 0;
  const canSave = !busy && (chosen.length > 0 || feedbackCount > 0) && chosen.every((r) => r.label.trim() !== "");

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      await onSave({
        rounds: chosen.map((r) => {
          const p = Number(r.passPct);
          return {
            round_label: r.label.trim(),
            file_name: fileName,
            pass_pct: r.passPct.trim() !== "" && Number.isFinite(p) ? Math.min(100, Math.max(0, Math.round(p))) : null,
            round_date: r.date || null,
            rows: r.rows,
          };
        }),
        feedback: includeFeedback ? feedback : [],
        overwriteFeedback,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 w-full sm:max-w-3xl max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">📤 Upload results from Excel</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Into “{folderName}”. Any layout works — your own file, as it is. We find the tables, names, marks, attempts and feedback; you check and save.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none px-1" aria-label="Close">×</button>
        </div>

        {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => void onFile(e.target.files?.[0])}
          className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-violet-500"
        />

        {loaded && (
          <>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
              Found <b>{rounds.length}</b> round{rounds.length === 1 ? "" : "s"}
              {feedback.length > 0 && <> and feedback for <b>{feedback.length}</b> {feedback.length === 1 ? "person" : "people"}</>} in
              {" "}{sheets.length} sheet{sheets.length === 1 ? "" : "s"}. Untick anything you do not want.
            </div>

            {rounds.map((r) => {
              const withMarks = r.rows.filter((x) => x.percent !== null).length;
              const dup = taken.has(r.label.trim().toLowerCase());
              return (
                <div key={r.id} className={`rounded-xl border p-3 space-y-2 ${r.include ? "border-violet-500/40 bg-violet-500/5" : "border-slate-800 opacity-70"}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={r.include} onChange={(e) => patch(r.id, { include: e.target.checked })} className="mt-1.5 h-4 w-4 accent-violet-500" aria-label="Include this round" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${r.kind === "attempt" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                          {r.kind === "attempt" ? "Re-attempt" : "Round"}
                        </span>
                        <span className="text-xs text-slate-500 truncate">{r.source}</span>
                        {dup && <span className="text-[10px] font-semibold text-amber-300">name already in this folder</span>}
                        {withMarks === 0 && <span className="text-[10px] font-semibold text-red-300">no marks found</span>}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_9.5rem_7rem]">
                        <input className={input} value={r.label} onChange={(e) => patch(r.id, { label: e.target.value })} aria-label="Round name" />
                        <input type="date" className={input} value={r.date} onChange={(e) => patch(r.id, { date: e.target.value })} aria-label="Date" />
                        <input type="number" min={0} max={100} className={input} value={r.passPct} onChange={(e) => patch(r.id, { passPct: e.target.value })} placeholder="Pass %" aria-label="Pass mark percent" />
                      </div>
                      {r.attempt && (
                        <label className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          The numbers in this column are
                          <select className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-xs text-white" value={r.attempt.mode} onChange={(e) => changeMode(r, e.target.value as ValueMode)}>
                            {(Object.keys(MODE_LABEL) as ValueMode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
                          </select>
                        </label>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <tbody>
                            {r.rows.slice(0, 4).map((x, i) => (
                              <tr key={i} className="border-t border-slate-800 text-slate-300">
                                <td className="py-1 pr-3 whitespace-nowrap">{x.name}</td>
                                <td className="py-1 pr-3 font-mono whitespace-nowrap">{x.percent === null ? "—" : `${x.percent}%`}</td>
                                <td className="py-1 text-slate-500 truncate max-w-[16rem]">{x.remarks}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="text-[11px] text-slate-500 mt-1">{r.rows.length} candidate{r.rows.length === 1 ? "" : "s"}{r.rows.length > 4 ? " — first 4 shown" : ""}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {feedback.length > 0 && (
              <div className={`rounded-xl border p-3 space-y-2 ${includeFeedback ? "border-violet-500/40 bg-violet-500/5" : "border-slate-800 opacity-70"}`}>
                <label className="flex items-center gap-3 text-sm text-white font-semibold">
                  <input type="checkbox" checked={includeFeedback} onChange={(e) => setIncludeFeedback(e.target.checked)} className="h-4 w-4 accent-violet-500" />
                  Feedback for {feedback.length} {feedback.length === 1 ? "person" : "people"}
                </label>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {feedback.slice(0, 4).map((f) => (
                        <tr key={f.name} className="border-t border-slate-800 text-slate-300">
                          <td className="py-1 pr-3 whitespace-nowrap align-top">{f.name}</td>
                          <td className="py-1 text-slate-400">{f.text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {feedback.length > 4 && <p className="text-[11px] text-slate-500 mt-1">first 4 shown</p>}
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" checked={overwriteFeedback} onChange={(e) => setOverwriteFeedback(e.target.checked)} className="h-3.5 w-3.5 accent-violet-500" />
                  Replace feedback I already wrote for the same people (otherwise only empty ones are filled)
                </label>
              </div>
            )}

            {skipped.length > 0 && (
              <div className="rounded-xl border border-slate-800 px-3 py-2 text-xs text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">Left out</div>
                {skipped.map((s, i) => <div key={i}><span className="text-slate-300">{s.where}</span> — {s.reason}</div>)}
              </div>
            )}

            <div className="rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => { setShowManual((v) => !v); if (!mMapping) startManual(0, "1"); }}
                className="w-full text-left px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white"
              >
                {showManual ? "▲" : "▼"} Something missing? Pick a table yourself
              </button>
              {showManual && manualSheet && (
                <div className="px-3 pb-3 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-xs text-slate-400">Sheet
                      <select className={`${input} mt-1`} value={mSheet} onChange={(e) => startManual(Number(e.target.value), mHeaderRow)}>
                        {sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-slate-400">Row that holds the column titles
                      <input type="number" min={1} className={`${input} mt-1`} value={mHeaderRow} onChange={(e) => startManual(mSheet, e.target.value)} />
                    </label>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-[11px]">
                      <tbody>
                        {manualSheet.data.slice(Math.max(0, (Number(mHeaderRow) || 1) - 1), (Number(mHeaderRow) || 1) + 3).map((r, i) => (
                          <tr key={i} className={i === 0 ? "bg-slate-800 text-white font-semibold" : "text-slate-400"}>
                            {r.slice(0, 8).map((c, j) => <td key={j} className="px-2 py-1 whitespace-nowrap">{cell(c)}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {mMapping && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {MANUAL_FIELDS.map((f) => (
                        <label key={f.key} className="block text-xs text-slate-400">
                          {f.label}{f.required ? " *" : ""}
                          <select
                            className={`${input} mt-1`}
                            value={mMapping[f.key] === null ? "" : String(mMapping[f.key])}
                            onChange={(e) => setMMapping({ ...mMapping, [f.key]: e.target.value === "" ? null : Number(e.target.value) })}
                          >
                            <option value="">— not in my file —</option>
                            {manualHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                          </select>
                        </label>
                      ))}
                      {mMapping.total === null && (
                        <label className="block text-xs text-slate-400">Out of (same for everyone)
                          <input type="number" min={1} className={`${input} mt-1`} value={mTotal} onChange={(e) => setMTotal(e.target.value)} placeholder="e.g. total marks of the paper" />
                        </label>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={addManual}
                    disabled={!mMapping || mMapping.name === null}
                    className="text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg px-4 py-2"
                  >
                    Add this table as a round
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="text-sm font-semibold text-slate-400 hover:text-slate-200 px-4 py-2">Cancel</button>
          <button
            onClick={() => void save()}
            disabled={!canSave}
            className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg px-5 py-2"
          >
            {busy ? "Saving…" : `Save ${chosen.length} round${chosen.length === 1 ? "" : "s"}${feedbackCount > 0 ? ` + feedback` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
