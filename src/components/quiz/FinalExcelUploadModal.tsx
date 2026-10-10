import { useMemo, useState } from "react";
import {
  readXlsxFile,
  guessMapping,
  mapRows,
  downloadSampleXlsx,
  type ColumnMapping,
  type MappingField,
  type ParsedSheet,
} from "../../services/quiz/quizFinalReportService";
import type { FinalUploadRow } from "../../types/quiz";

interface Props {
  folderName: string;
  onClose: () => void;
  onSave: (input: { round_label: string; file_name: string; pass_pct: number | null; round_date: string | null; rows: FinalUploadRow[] }) => Promise<void>;
}

const FIELDS: { key: MappingField; label: string; required?: boolean }[] = [
  { key: "name", label: "Candidate name", required: true },
  { key: "score", label: "Marks obtained" },
  { key: "total", label: "Out of (total marks)" },
  { key: "percent", label: "Percent" },
  { key: "correct", label: "Correct answers" },
  { key: "wrong", label: "Wrong answers" },
  { key: "remarks", label: "Remarks / feedback in the file" },
];

/** Brings one round of results in from an Excel file. The trainer says which column is which, so any layout works. */
export default function FinalExcelUploadModal({ folderName, onClose, onSave }: Props) {
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [passPct, setPassPct] = useState("");
  const [defaultTotal, setDefaultTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!/\.xlsx$/i.test(file.name)) {
      setError("Please choose an Excel file saved as .xlsx (in Excel: File → Save As → Excel Workbook).");
      return;
    }
    try {
      const parsed = await readXlsxFile(file);
      if (parsed.headers.length === 0 || parsed.body.length === 0) {
        setError("This file looks empty. The first row should have column titles and the next rows the candidates.");
        return;
      }
      setSheet(parsed);
      setFileName(file.name);
      setLabel(file.name.replace(/\.xlsx$/i, "").replace(/[_-]+/g, " ").trim());
      setMapping(guessMapping(parsed.headers));
    } catch {
      setError("Could not read this file. Please save it again as a normal .xlsx workbook and retry.");
    }
  }

  const rows = useMemo(() => {
    if (!sheet || !mapping) return [];
    const t = Number(defaultTotal);
    return mapRows(sheet.body, mapping, defaultTotal.trim() !== "" && Number.isFinite(t) && t > 0 ? t : null);
  }, [sheet, mapping, defaultTotal]);

  const noPercent = rows.length > 0 && rows.every((r) => r.percent === null);
  const canSave = !!mapping && mapping.name !== null && rows.length > 0 && label.trim() !== "" && !noPercent && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      const p = Number(passPct);
      await onSave({
        round_label: label.trim(),
        file_name: fileName,
        pass_pct: passPct.trim() !== "" && Number.isFinite(p) ? Math.min(100, Math.max(0, Math.round(p))) : null,
        round_date: date || null,
        rows,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this round.");
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">📤 Upload an Excel round</h3>
            <p className="text-xs text-slate-400 mt-0.5">Into “{folderName}”. It joins the combined report as one more round — matched to the other rounds by candidate name.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none px-1" aria-label="Close">×</button>
        </div>

        {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-2">
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => void onFile(e.target.files?.[0])}
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-violet-500"
          />
          <button onClick={() => void downloadSampleXlsx("final-result-round-sample.xlsx")} className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline">
            ⬇ Download a sample Excel to see the layout
          </button>
        </div>

        {sheet && mapping && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-slate-400 sm:col-span-2">
                Round name (shown as a column in the report)
                <input className={`${input} mt-1`} value={label} onChange={(e) => setLabel(e.target.value)} />
              </label>
              <label className="block text-xs text-slate-400">
                Date of this round
                <input type="date" className={`${input} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="block text-xs text-slate-400">
                Pass mark % (optional)
                <input type="number" min={0} max={100} className={`${input} mt-1`} value={passPct} onChange={(e) => setPassPct(e.target.value)} placeholder="Leave empty if not needed" />
              </label>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-300 mb-1.5">Which column is which? <span className="font-normal text-slate-500">(we guessed — correct anything that is off)</span></div>
              <div className="grid gap-2 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <label key={f.key} className="block text-xs text-slate-400">
                    {f.label}{f.required ? " *" : ""}
                    <select
                      className={`${input} mt-1`}
                      value={mapping[f.key] === null ? "" : String(mapping[f.key])}
                      onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value === "" ? null : Number(e.target.value) })}
                    >
                      <option value="">— not in my file —</option>
                      {sheet.headers.map((h, i) => (
                        <option key={i} value={i}>{h}</option>
                      ))}
                    </select>
                  </label>
                ))}
                {mapping.total === null && (
                  <label className="block text-xs text-slate-400">
                    Out of (same for everyone)
                    <input type="number" min={1} className={`${input} mt-1`} value={defaultTotal} onChange={(e) => setDefaultTotal(e.target.value)} placeholder="e.g. total marks of the paper" />
                  </label>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <div className="px-3 py-2 text-xs text-slate-400 bg-slate-950/40">
                {rows.length} candidate{rows.length === 1 ? "" : "s"} found{rows.length > 5 ? " — first 5 shown" : ""}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 text-left">
                      <th className="px-3 py-1.5">Name</th><th className="px-3 py-1.5">Marks</th><th className="px-3 py-1.5">Out of</th><th className="px-3 py-1.5">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-t border-slate-800 text-slate-200">
                        <td className="px-3 py-1.5">{r.name}</td>
                        <td className="px-3 py-1.5">{r.score ?? "—"}</td>
                        <td className="px-3 py-1.5">{r.total ?? "—"}</td>
                        <td className="px-3 py-1.5">{r.percent ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {noPercent && (
              <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                No percent could be worked out. Choose the Percent column, or both Marks and Out of (or type the “Out of” number).
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="text-sm font-semibold text-slate-400 hover:text-slate-200 px-4 py-2">Cancel</button>
          <button
            onClick={() => void save()}
            disabled={!canSave}
            className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg px-5 py-2"
          >
            {busy ? "Saving…" : "Save this round"}
          </button>
        </div>
      </div>
    </div>
  );
}
