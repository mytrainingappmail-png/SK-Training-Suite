import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import QuizAdminCertificateButton from "../../components/quiz/QuizAdminCertificateButton";
import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { listFoldersForCompany, createFolder } from "../../repositories/quiz/quizResultFolderRepository";
import type { QuizResultFolder } from "../../types/quiz";
import { csvEscape, downloadCsvFile } from "../../services/quiz/quizCsvService";
import {
  getExamSessionAdmin, getExamParticipantsAdmin, getExamResults, getExamParticipantDetail, getExamQuestionStats,
  getExamSessionFolder, moveExamSessionToFolder, startExamNow, extendExamSession, endExamSession, releaseExamResults, gradeExamAnswer, signedPhotoUrls,
} from "../../repositories/exam/examAdminRepository";
import type { ExamSessionAdmin, ExamParticipantAdmin, ExamResultRow, ExamDetailRow, ExamQuestionStat } from "../../types/exam";

const POLL_MS = 4000;

function clock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`;
}

function totalOf(r: ExamResultRow): number {
  return r.auto_marks + r.manual_marks;
}
function pctOf(r: ExamResultRow): number {
  return r.possible_marks > 0 ? Math.round((totalOf(r) / r.possible_marks) * 1000) / 10 : 0;
}

/** One exam session, start to finish: lobby -> live monitor -> (only once it's over) everyone's results, hand-marking of written answers, and releasing results to employees. */
export default function ExamHostPage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<ExamSessionAdmin | null>(null);
  const [participants, setParticipants] = useState<ExamParticipantAdmin[]>([]);
  const [results, setResults] = useState<ExamResultRow[] | null>(null);
  const [stats, setStats] = useState<ExamQuestionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [extendText, setExtendText] = useState("10");
  const [copied, setCopied] = useState("");
  const [now, setNow] = useState(0);

  const [openParticipant, setOpenParticipant] = useState<ExamResultRow | null>(null);
  const [detail, setDetail] = useState<ExamDetailRow[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [markInputs, setMarkInputs] = useState<Record<string, { marks: string; comment: string }>>({});
  const [markingId, setMarkingId] = useState<string | null>(null);
  const admin = getCurrentQuizAdmin();
  const [folders, setFolders] = useState<QuizResultFolder[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (!admin || !sessionId) return;
    void (async () => {
      try {
        setFolders(await listFoldersForCompany(admin.company_id));
        setFolderId(await getExamSessionFolder(sessionId));
      } catch { /* folders are optional - the page works without them */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function changeFolder(value: string) {
    try {
      let target: string | null = value === "" ? null : value;
      if (value === "__new__") {
        const name = prompt("Name for the new folder (e.g. Batch 12 - Induction):")?.trim();
        if (!name || !admin) return;
        const created = await createFolder(admin.company_id, name, admin.id);
        setFolders((f) => [created, ...f]);
        target = created.id;
      }
      await moveExamSessionToFolder(sessionId, target);
      setFolderId(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not move to the folder.");
    }
  }

  const clockOffsetMs = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const before = Date.now();
      const s = await getExamSessionAdmin(sessionId);
      clockOffsetMs.current = new Date(s.server_now).getTime() - (before + Date.now()) / 2;
      setSession(s);
      setParticipants(await getExamParticipantsAdmin(sessionId));
      if (s.status === "finished") {
        setResults(await getExamResults(sessionId));
        setStats(await getExamQuestionStats(sessionId).catch(() => []));
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the exam.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (session?.status === "finished") return;
    const t = setInterval(() => { void refresh(); }, POLL_MS);
    return () => clearInterval(t);
  }, [session?.status, refresh]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + clockOffsetMs.current), 1000);
    setNow(Date.now() + clockOffsetMs.current);
    return () => clearInterval(t);
  }, []);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    });
  }

  async function openDetail(r: ExamResultRow) {
    setOpenParticipant(r);
    setDetailLoading(true);
    try {
      const rows = await getExamParticipantDetail(r.participant_id);
      setDetail(rows);
      const inputs: Record<string, { marks: string; comment: string }> = {};
      for (const d of rows) if (d.answer_id && d.type === "written") inputs[d.answer_id] = { marks: d.marks_awarded === null ? "" : String(d.marks_awarded), comment: d.grader_comment ?? "" };
      setMarkInputs(inputs);
      setPhotoUrls(await signedPhotoUrls(rows.flatMap((d) => d.image_paths)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the answers.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveMarks(d: ExamDetailRow) {
    if (!d.answer_id) return;
    const input = markInputs[d.answer_id];
    const marks = Number(input?.marks);
    if (input?.marks === "" || !Number.isFinite(marks) || marks < 0 || marks > d.marks) {
      setError(`Marks for this answer must be between 0 and ${d.marks}.`);
      return;
    }
    setMarkingId(d.answer_id);
    setError("");
    try {
      await gradeExamAnswer(d.answer_id, marks, input.comment);
      if (openParticipant) await openDetail(openParticipant);
      setResults(await getExamResults(sessionId));
      setOpenParticipant((prev) => prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the marks.");
    } finally {
      setMarkingId(null);
    }
  }

  const ranked = useMemo(() => (results ?? []).slice().sort((a, b) => totalOf(b) - totalOf(a) || a.display_name.localeCompare(b.display_name)), [results]);
  const pendingTotal = ranked.reduce((s, r) => s + r.pending_written, 0);

  function exportCsv() {
    if (!session) return;
    const head = ["Rank", "Name", "Auto marks", "Written marks", "Total", "Out of", "Percent", "Result", "Written pending", "Tab switches", "Submitted", "How"];
    const lines = ranked.map((r, i) => [
      String(i + 1), r.display_name, String(r.auto_marks), String(r.manual_marks), String(totalOf(r)), String(r.possible_marks), `${pctOf(r)}%`,
      pctOf(r) >= session.passing_score_pct ? "Pass" : "Fail", String(r.pending_written), String(r.tab_switches),
      r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "", r.submit_reason ?? "",
    ]);
    const csv = [head, ...lines].map((row) => row.map(csvEscape).join(",")).join("\r\n");
    downloadCsvFile(`${session.quiz_title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-exam-results.csv`, csv);
  }

  if (loading) return <div className="text-slate-500 text-sm p-6">Loading…</div>;
  if (!session) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-red-300">{error || "Exam not found."}</p>
        <button onClick={() => navigate(ROUTES.QUIZ_ADMIN_EXAMS)} className="text-sm text-slate-300 border border-slate-700 rounded-lg px-4 py-2">← Back to Exams</button>
      </div>
    );
  }

  const opensAtMs = new Date(session.opens_at).getTime();
  const deadlineMs = new Date(session.deadline_at).getTime();
  const startsIn = Math.max(0, Math.ceil((opensAtMs - now) / 1000));
  const timeLeft = Math.max(0, Math.ceil((deadlineMs - now) / 1000));
  const joinUrl = `${window.location.origin}${ROUTES.EXAM_JOIN}`;
  const allIn = session.joined > 0 && session.submitted === session.joined;
  const live = session.status !== "finished";

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 space-y-6 pb-20 text-white">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-bold break-words">{session.quiz_title} — Exam</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {session.status === "lobby" && "⏳ Waiting to start"}
            {session.status === "running" && "🔴 Running"}
            {session.status === "closing" && "⌛ Time's up — collecting final answers…"}
            {session.status === "finished" && "⚪ Finished"}
            {" · "}{session.total_questions} questions · {session.total_marks} marks · pass {session.passing_score_pct}%
          </p>
        </div>
        <button onClick={() => navigate(ROUTES.QUIZ_ADMIN_EXAMS)} className="text-sm font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-4 py-2">← Back to Exams</button>
      </div>

      {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

      {live && (
        <div className="bg-gradient-to-br from-violet-900/40 to-slate-900 border border-violet-700/40 rounded-2xl p-6 sm:p-8 text-center space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">Employees go to</p>
          <p className="text-lg font-semibold break-all">{joinUrl}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">and enter PIN</p>
          <p className="text-5xl font-mono font-black tracking-[0.2em] text-amber-400">{session.pin}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={() => copy(joinUrl, "link")} className="text-xs font-semibold text-violet-200 border border-violet-500/40 hover:bg-violet-500/10 rounded-lg px-3 py-1.5">{copied === "link" ? "✓ Link copied" : "📋 Copy link"}</button>
            <button onClick={() => copy(session.pin, "pin")} className="text-xs font-semibold text-violet-200 border border-violet-500/40 hover:bg-violet-500/10 rounded-lg px-3 py-1.5">{copied === "pin" ? "✓ PIN copied" : "📋 Copy PIN"}</button>
            <button onClick={() => copy(`Join the exam: ${joinUrl}\nPIN: ${session.pin}`, "both")} className="text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-lg px-3 py-1.5">{copied === "both" ? "✓ Copied" : "📋 Copy both (WhatsApp-ready)"}</button>
          </div>

          {session.status === "lobby" && (
            <div className="pt-2 space-y-2">
              <p className="text-sm font-mono font-bold text-amber-300">⏳ Starts in {clock(startsIn)}</p>
              <button onClick={() => act(() => startExamNow(sessionId))} disabled={busy} className="text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg px-5 py-2.5">▶ Start now</button>
              <p className="text-[11px] text-slate-400">Employees who join now wait in a lobby. The paper time only starts when it opens.</p>
            </div>
          )}

          {session.status === "running" && (
            <div className="pt-2 space-y-3">
              <p className={`text-lg font-mono font-bold ${timeLeft <= 300 ? "text-red-400 animate-pulse" : "text-slate-100"}`}>⏱ {clock(timeLeft)} left</p>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 flex-wrap">
                Add
                <input type="number" min={1} step="any" value={extendText} onChange={(e) => setExtendText(e.target.value)} className="w-16 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-white text-center" />
                min
                <button
                  onClick={() => { const m = Number(extendText); if (!Number.isFinite(m) || m <= 0) { setError("Enter how many minutes to add."); return; } void act(() => extendExamSession(sessionId, Math.round(m * 60))); }}
                  className="font-semibold text-violet-200 border border-violet-500/40 hover:bg-violet-500/10 rounded-lg px-3 py-1"
                >
                  + Extend time for everyone
                </button>
              </div>
            </div>
          )}

          {session.status !== "lobby" && (
            <div className="pt-2">
              <button
                onClick={() => { if (confirm(allIn ? "End the exam and show results?" : `Only ${session.submitted} of ${session.joined} have submitted. Ending now submits everyone's saved answers as they are. End the exam?`)) void act(() => endExamSession(sessionId)); }}
                disabled={busy}
                className={`text-sm font-semibold disabled:opacity-50 rounded-lg px-5 py-2.5 ${allIn ? "bg-emerald-600 hover:bg-emerald-500 animate-pulse" : "bg-red-600 hover:bg-red-500"}`}
              >
                {allIn ? "✅ Everyone has submitted — Show results" : "⏹ End exam & show results"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Live monitor */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold">Employees ({session.joined})</h2>
          <span className="text-xs text-slate-400">{session.submitted} submitted</span>
        </div>
        {participants.length === 0 ? (
          <p className="text-xs text-slate-500">Nobody has joined yet — share the PIN above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
                  <th className="py-2 pr-3 font-semibold">Name</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Answered</th>
                  <th className="py-2 font-semibold">Left the tab</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.participant_id} className="border-b border-slate-800/60 last:border-0">
                    <td className="py-2 pr-3 font-medium">{p.display_name}</td>
                    <td className="py-2 pr-3">
                      {p.submitted_at
                        ? <span className="text-emerald-300 text-xs">✓ Submitted{p.submit_reason === "timeout" ? " (time up)" : p.submit_reason === "ended_by_admin" ? " (you ended it)" : ""}</span>
                        : session.status === "lobby" ? <span className="text-slate-400 text-xs">Waiting</span> : <span className="text-amber-300 text-xs">✍️ Writing…</span>}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-300">{p.answered_count}/{session.total_questions}</td>
                    <td className={`py-2 font-mono text-xs ${p.tab_switches > 0 ? "text-amber-300" : "text-slate-500"}`}>{p.tab_switches}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {live && <p className="text-[11px] text-slate-500 mt-3">🔒 Marks stay hidden until the exam has finished, so nobody's score is seen while others are still writing.</p>}
      </div>

      {/* Results */}
      {session.status === "finished" && results && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Employees" value={String(ranked.length)} />
            <Stat label="Average" value={ranked.length ? `${Math.round((ranked.reduce((s, r) => s + pctOf(r), 0) / ranked.length) * 10) / 10}%` : "—"} />
            <Stat label="Passed" value={`${ranked.filter((r) => pctOf(r) >= session.passing_score_pct).length}/${ranked.length}`} />
            <Stat label="Written to mark" value={String(pendingTotal)} warn={pendingTotal > 0} />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
              <h2 className="text-sm font-bold">Results</h2>
              <div className="flex gap-2 flex-wrap">
                {canEditQuizContent() && (
                  <select
                    value={folderId ?? ""}
                    onChange={(e) => void changeFolder(e.target.value)}
                    title="Save this result in a Batch Record folder"
                    className="text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5"
                  >
                    <option value="">📁 No folder</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>📁 {f.name}</option>)}
                    <option value="__new__">＋ New folder…</option>
                  </select>
                )}
                <button onClick={exportCsv} className="text-xs font-semibold text-slate-200 border border-slate-700 hover:bg-slate-800 rounded-lg px-3 py-1.5">⬇ Download CSV</button>
                <button
                  onClick={() => { if (!session.results_released && pendingTotal > 0 && !confirm(`${pendingTotal} written answer(s) are still unmarked and will show as 0. Share results anyway?`)) return; void act(() => releaseExamResults(sessionId, !session.results_released)); }}
                  disabled={busy}
                  className={`text-xs font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50 ${session.results_released ? "border border-emerald-500/40 text-emerald-300" : "bg-amber-400 hover:bg-amber-300 text-amber-950"}`}
                >
                  {session.results_released ? "✓ Results shared with employees — click to hide" : "📢 Release results to employees"}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
                    <th className="py-2 pr-3 font-semibold">#</th>
                    <th className="py-2 pr-3 font-semibold">Name</th>
                    <th className="py-2 pr-3 font-semibold">Marks</th>
                    <th className="py-2 pr-3 font-semibold">%</th>
                    <th className="py-2 pr-3 font-semibold">Result</th>
                    <th className="py-2 pr-3 font-semibold">Written</th>
                    <th className="py-2 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r, i) => {
                    const pass = pctOf(r) >= session.passing_score_pct;
                    return (
                      <tr key={r.participant_id} className="border-b border-slate-800/60 last:border-0">
                        <td className="py-2 pr-3 text-slate-500 font-mono text-xs">{i + 1}</td>
                        <td className="py-2 pr-3 font-medium">{r.display_name}{r.tab_switches > 0 && <span className="ml-2 text-[10px] text-amber-300" title="Times they left the exam tab">⚠ {r.tab_switches}×</span>}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{totalOf(r)}/{r.possible_marks}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{pctOf(r)}%</td>
                        <td className="py-2 pr-3"><span className={`text-xs font-bold rounded-full px-2 py-0.5 ${pass ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{pass ? "Pass" : "Fail"}</span></td>
                        <td className="py-2 pr-3 text-xs">{r.pending_written > 0 ? <span className="text-amber-300">{r.pending_written} to mark</span> : <span className="text-slate-500">—</span>}</td>
                        <td className="py-2 text-right whitespace-nowrap">{pass && admin && r.pending_written === 0 && <span className="mr-2 inline-block align-middle"><QuizAdminCertificateButton kind="exam" participantId={r.participant_id} companyId={admin.company_id} /></span>}<button onClick={() => void openDetail(r)} className="text-xs font-semibold text-violet-300 hover:text-violet-200">View / mark</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {stats.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
              <h2 className="text-sm font-bold mb-1">Which questions were hardest</h2>
              <p className="text-xs text-slate-500 mb-3">Share of employees who got each question fully right — low numbers show what needs more training.</p>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {stats.filter((s) => s.type !== "written").slice().sort((a, b) => (a.attempted ? a.correct / a.attempted : 1) - (b.attempted ? b.correct / b.attempted : 1)).map((s) => {
                  const pct = s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : 0;
                  return (
                    <div key={s.question_id} className="text-xs">
                      <div className="flex justify-between gap-2 text-slate-300"><span className="truncate">{s.question_text}</span><span className="font-mono shrink-0">{pct}% ({s.correct}/{s.attempted})</span></div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full rounded-full ${pct < 40 ? "bg-red-500" : pct < 70 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {openParticipant && (
        <div className="fixed inset-0 z-50 bg-black/70 overflow-y-auto" onClick={() => setOpenParticipant(null)}>
          <div className="max-w-3xl mx-auto my-6 px-3" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold">{openParticipant.display_name}</h2>
                  <p className="text-xs text-slate-400">{totalOf(openParticipant)}/{openParticipant.possible_marks} marks · {pctOf(openParticipant)}%</p>
                </div>
                <button onClick={() => setOpenParticipant(null)} className="text-sm text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5">Close</button>
              </div>
              {detailLoading ? <p className="text-sm text-slate-500">Loading…</p> : (
                <div className="space-y-3">
                  {detail.map((d) => (
                    <div key={d.question_id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold">Q{d.question_order + 1}. {d.question_text}</p>
                        <span className="text-xs font-mono text-slate-400 shrink-0">{d.marks_awarded ?? 0}/{d.marks}</span>
                      </div>

                      {d.type === "written" ? (
                        <div className="mt-2 space-y-2">
                          {d.text_answer ? <p className="text-sm text-slate-200 bg-slate-800/60 rounded-lg px-3 py-2 whitespace-pre-wrap">{d.text_answer}</p> : d.image_paths.length === 0 && <p className="text-xs text-slate-500">— Not answered</p>}
                          {d.image_paths.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {d.image_paths.map((p) => photoUrls[p] ? (
                                <a key={p} href={photoUrls[p]} target="_blank" rel="noreferrer"><img src={photoUrls[p]} alt="Answer photo" className="h-32 w-32 object-cover rounded-lg border border-slate-700" /></a>
                              ) : <div key={p} className="h-32 w-32 rounded-lg bg-slate-800" />)}
                            </div>
                          )}
                          {d.explanation && <p className="text-xs text-emerald-300/80">Model answer: {d.explanation}</p>}
                          {d.answer_id && d.answered && (
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="number" min={0} max={d.marks} step="any"
                                value={markInputs[d.answer_id]?.marks ?? ""}
                                onChange={(e) => setMarkInputs((m) => ({ ...m, [d.answer_id!]: { marks: e.target.value, comment: m[d.answer_id!]?.comment ?? "" } }))}
                                placeholder={`0-${d.marks}`}
                                className="w-20 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white"
                              />
                              <input
                                value={markInputs[d.answer_id]?.comment ?? ""}
                                onChange={(e) => setMarkInputs((m) => ({ ...m, [d.answer_id!]: { marks: m[d.answer_id!]?.marks ?? "", comment: e.target.value } }))}
                                placeholder="Comment (optional, employee sees it if you release results)"
                                className="flex-1 min-w-[10rem] rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white"
                              />
                              <button onClick={() => void saveMarks(d)} disabled={markingId === d.answer_id} className="text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg px-3 py-2">
                                {markingId === d.answer_id ? "Saving…" : d.marks_awarded === null ? "Save marks" : "Update"}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : d.type === "hotspot" ? (
                        <div className="mt-2">
                          {d.image_url && d.click_x !== null && d.click_y !== null ? (
                            <div className="relative inline-block max-w-full rounded-lg overflow-hidden border border-slate-700">
                              <img src={d.image_url} alt="Map" className="block max-w-full h-auto max-h-64" />
                              <span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: `${d.click_x}%`, top: `${d.click_y}%`, background: d.is_correct ? "#10b981" : "#ef4444" }} />
                            </div>
                          ) : <p className="text-xs text-slate-500">— Not answered</p>}
                          <p className={`text-xs mt-1 ${d.is_correct ? "text-emerald-300" : "text-red-300"}`}>{d.is_correct ? "✓ Tapped inside the correct area" : d.answered ? "✗ Tapped outside the correct area" : ""}</p>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs space-y-0.5">
                          <p className={d.is_correct ? "text-emerald-300" : "text-slate-300"}>
                            {d.answered ? <>{d.is_correct ? "✓" : "✗"} {d.selected_option_text}</> : <span className="text-slate-500">— Not answered</span>}
                          </p>
                          {!d.is_correct && d.correct_option_text && <p className="text-emerald-300/80">Correct: {d.correct_option_text}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
      <p className={`text-2xl font-bold ${warn ? "text-amber-300" : "text-white"}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-slate-500 mt-1">{label}</p>
    </div>
  );
}

