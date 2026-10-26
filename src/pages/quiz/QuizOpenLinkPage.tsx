// The trainer's page for one test's "open link": switch it on, share the link / QR, set the rules, and see every attempt.
// Trainees open the link and press Start - no PIN, and each one's own timer starts at that moment.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { getQuiz } from "../../services/quiz/quizService";
import { csvEscape, downloadCsvFile } from "../../services/quiz/quizCsvService";
import { ensureOpenLink, updateOpenLink, listOpenTestAttempts, sweepOpenTests } from "../../repositories/quiz/quizOpenLinkRepository";
import type { OpenTestAttempt, Quiz, QuizOpenLink } from "../../types/quiz";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";
}

const STATUS_LABEL: Record<OpenTestAttempt["status"], { text: string; cls: string }> = {
  in_progress: { text: "In progress", cls: "text-amber-300" },
  finished: { text: "Finished", cls: "text-emerald-300" },
  time_up: { text: "Time up", cls: "text-emerald-300" },
  not_submitted: { text: "Not submitted", cls: "text-slate-400" },
};
const RESULT_CLS: Record<string, string> = {
  PASS: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  NEED_IMPROVEMENT: "text-amber-300 bg-amber-500/15 border-amber-500/30",
  FAIL: "text-red-300 bg-red-500/15 border-red-500/30",
};

export default function QuizOpenLinkPage() {
  const { quizId = "" } = useParams<{ quizId: string }>();
  const admin = getCurrentQuizAdmin();
  const canEdit = canEditQuizContent();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [link, setLink] = useState<QuizOpenLink | null>(null);
  const [attempts, setAttempts] = useState<OpenTestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");

  // rules (kept as text while typing)
  const [opensLocal, setOpensLocal] = useState("");
  const [closesLocal, setClosesLocal] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("");
  const [release, setRelease] = useState<"immediate" | "manual">("immediate");

  const isExam = quiz?.mode === "exam";
  const listRoute = isExam ? ROUTES.QUIZ_ADMIN_EXAMS : ROUTES.QUIZ_ADMIN_QUIZZES;
  const url = link ? `${window.location.origin}${ROUTES.OPEN_TEST.replace(":token", link.token)}` : "";

  function applyLink(l: QuizOpenLink) {
    setLink(l);
    setOpensLocal(toLocalInput(l.opens_at));
    setClosesLocal(toLocalInput(l.closes_at));
    setMaxAttempts(l.max_attempts ? String(l.max_attempts) : "");
    setRelease(l.release_results);
  }

  const refreshAttempts = useCallback(async (linkId: string) => {
    try {
      await sweepOpenTests(linkId);
      setAttempts(await listOpenTestAttempts(linkId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the attempts.");
    }
  }, []);

  useEffect(() => {
    if (!admin || !quizId) return;
    let cancelled = false;
    (async () => {
      try {
        const q = await getQuiz(quizId);
        if (!q) throw new Error("Test not found.");
        const l = await ensureOpenLink(admin.company_id, quizId);
        if (cancelled) return;
        setQuiz(q);
        applyLink(l);
        await refreshAttempts(l.id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not open this page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  // keep the attempts fresh while the page is open
  useEffect(() => {
    if (!link) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") void refreshAttempts(link.id); }, 15000);
    return () => clearInterval(t);
  }, [link, refreshAttempts]);

  // QR of the link (made in the browser, nothing is sent anywhere)
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    import("qrcode").then((m) => m.toDataURL(url, { width: 320, margin: 2 })).then((d) => { if (!cancelled) setQr(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [url]);

  async function save(patch: Parameters<typeof updateOpenLink>[1], message: string) {
    if (!link) return;
    setSaving(true);
    setError("");
    try {
      applyLink(await updateOpenLink(link.id, patch));
      setSaved(message);
      setTimeout(() => setSaved(""), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  function saveRules() {
    const max = maxAttempts.trim() === "" ? null : Number(maxAttempts);
    if (max !== null && (!Number.isInteger(max) || max < 1 || max > 50)) { setError("Attempts per name must be a whole number from 1 to 50, or empty for unlimited."); return; }
    const opens = fromLocalInput(opensLocal);
    const closes = fromLocalInput(closesLocal);
    if (opens && closes && closes <= opens) { setError("The closing time must be after the opening time."); return; }
    void save({ opens_at: opens, closes_at: closes, max_attempts: max, release_results: release }, "Rules saved.");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy automatically — select the link and copy it.");
    }
  }

  function exportCsv() {
    const header = ["Name", "Started", "Finished", "Status", "Marks", "Total marks", "Percent", "Result", "Written answers to mark"];
    const rows = attempts.map((a) => [
      a.display_name, when(a.started_at), when(a.finished_at), STATUS_LABEL[a.status].text,
      a.marks_obtained == null ? "" : String(a.marks_obtained), a.total_marks == null ? "" : String(a.total_marks),
      a.percent == null ? "" : `${a.percent}%`, a.result ? a.result.replace("_", " ") : "", String(a.pending_written),
    ]);
    downloadCsvFile(`${(quiz?.title ?? "test").replace(/[^\p{L}\p{N}]+/gu, "-")}-open-link-attempts.csv`, [header, ...rows].map((r) => r.map((v) => csvEscape(String(v))).join(",")).join("\r\n"));
  }

  const summary = useMemo(() => {
    const done = attempts.filter((a) => a.status === "finished" || a.status === "time_up");
    const passed = done.filter((a) => a.result === "PASS").length;
    return {
      total: attempts.length,
      running: attempts.filter((a) => a.status === "in_progress").length,
      done: done.length,
      passPct: done.length ? Math.round((passed / done.length) * 100) : 0,
    };
  }, [attempts]);

  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;
  if (!quiz || !link) return <div className="text-sm text-red-300">{error || "Test not found."}</div>;

  const published = quiz.status === "published";

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={listRoute} className="text-xs font-semibold text-slate-400 hover:text-white">← Back to {isExam ? "Exams" : "Quizzes"}</Link>
          <h1 className="mt-1 text-xl font-bold text-white break-words">🔗 Open Link — {quiz.title}</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Trainees open the link, type their name and press Start — <b>no PIN</b>, any time. Each trainee's own timer starts the moment they press Start.
          </p>
        </div>
      </div>

      {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
      {!published && (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          This {isExam ? "exam" : "quiz"} is a draft. Publish it first — the link does not work until then.
        </div>
      )}

      <fieldset disabled={!canEdit} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Open link is {link.enabled ? <span className="text-emerald-300">ON</span> : <span className="text-slate-400">OFF</span>}</div>
            <div className="text-xs text-slate-500">{link.enabled ? "Anyone who has the link can start the test." : "Nobody can start the test with the link while it is off."}</div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save({ enabled: !link.enabled }, link.enabled ? "Link switched off." : "Link switched on.")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${link.enabled ? "bg-slate-700 hover:bg-slate-600" : "bg-emerald-600 hover:bg-emerald-500"}`}
          >
            {link.enabled ? "Switch OFF" : "Switch ON"}
          </button>
        </div>

        <div className="flex flex-wrap gap-5">
          <div className="min-w-[16rem] flex-1 space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Link to share</label>
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void copyLink()} className="rounded-lg border border-violet-500/50 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/10">
                {copied ? "✓ Copied" : "📋 Copy link"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Take the test "${quiz.title}": ${url}`)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Share on WhatsApp
              </a>
            </div>
          </div>
          {qr && (
            <div className="text-center">
              <img src={qr} alt="QR code of the test link" className="h-36 w-36 rounded-lg bg-white p-1" />
              <a href={qr} download={`${quiz.title.replace(/[^\p{L}\p{N}]+/gu, "-")}-qr.png`} className="mt-1 inline-block text-[11px] font-semibold text-violet-300 hover:text-violet-200">⬇ Download QR</a>
            </div>
          )}
        </div>
      </fieldset>

      <fieldset disabled={!canEdit} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Rules</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Opens (optional)</label>
            <input type="datetime-local" value={opensLocal} onChange={(e) => setOpensLocal(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Closes (optional)</label>
            <input type="datetime-local" value={closesLocal} onChange={(e) => setClosesLocal(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Attempts allowed per name</label>
            <input
              type="number"
              min={1}
              max={50}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
              placeholder="Unlimited"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            />
            <p className="mt-1 text-[11px] text-slate-500">Leave empty for no limit. The same name (any capital letters) counts as the same person.</p>
          </div>
          {isExam && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Result for the trainee</label>
              <select value={release} onChange={(e) => setRelease(e.target.value as "immediate" | "manual")} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
                <option value="immediate">Show it straight after they submit</option>
                <option value="manual">Only after I release it</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">An exam with written answers always waits until you have marked it and released it.</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={saving} onClick={saveRules} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
            💾 {saving ? "Saving…" : "Save rules"}
          </button>
          {saved && <span className="text-sm text-emerald-300">{saved}</span>}
          <span className="text-xs text-slate-500">
            {isExam ? `Each attempt gets the paper time of this exam (${quiz.exam_duration_minutes ?? 60} min) from the moment they press Start.` : "Each question uses its own timer, counted from the moment the trainee reaches it."}
          </span>
        </div>
      </fieldset>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-200">Attempts</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => void refreshAttempts(link.id)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">↻ Refresh</button>
            <button type="button" disabled={attempts.length === 0} onClick={exportCsv} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40">⬇ Download CSV</button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Attempts", summary.total, "text-white"],
            ["In progress", summary.running, "text-amber-300"],
            ["Finished", summary.done, "text-emerald-300"],
            ["Passed", `${summary.passPct}%`, "text-violet-300"],
          ].map(([label, value, cls]) => (
            <div key={String(label)} className="rounded-xl bg-slate-800/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
              <div className={`text-xl font-bold ${cls}`}>{value}</div>
            </div>
          ))}
        </div>

        {attempts.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No attempts yet. Share the link and they will appear here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Name</th>
                  <th className="py-2 pr-3 font-semibold">Started</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Marks</th>
                  <th className="py-2 pr-3 font-semibold">%</th>
                  <th className="py-2 pr-3 font-semibold">Result</th>
                  <th className="py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.participant_id} className="border-b border-slate-800/60 last:border-0">
                    <td className="py-2 pr-3 font-medium text-white">{a.display_name}{a.tab_switches > 0 && <span className="ml-2 text-[11px] text-amber-300" title="Times the trainee left the test tab">⚠ {a.tab_switches}×</span>}</td>
                    <td className="py-2 pr-3 text-xs text-slate-400 whitespace-nowrap">{when(a.started_at)}</td>
                    <td className={`py-2 pr-3 text-xs font-semibold ${STATUS_LABEL[a.status].cls}`}>{STATUS_LABEL[a.status].text}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-300">
                      {a.marks_obtained != null && a.total_marks != null ? `${a.marks_obtained}/${a.total_marks}` : "—"}
                      {a.pending_written > 0 && <span className="ml-1 text-[10px] text-amber-300">+{a.pending_written} written</span>}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-300">{a.percent != null && a.status !== "in_progress" ? `${a.percent}%` : "—"}</td>
                    <td className="py-2 pr-3">
                      {a.result && a.status !== "in_progress"
                        ? <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${RESULT_CLS[a.result]}`}>{a.result.replace("_", " ")}</span>
                        : <span className="text-xs text-slate-600">—</span>}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {a.kind === "exam" && (
                        <Link to={ROUTES.QUIZ_ADMIN_EXAM_HOST.replace(":sessionId", a.session_id)} className="text-xs font-semibold text-violet-300 hover:text-violet-200">View / mark</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
