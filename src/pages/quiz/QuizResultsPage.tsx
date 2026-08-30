import { useEffect, useMemo, useState } from "react";

import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { listSessionsForCompany, deleteSession, deleteAllSessions } from "../../repositories/quiz/quizSessionRepository";
import { getCompanySessionResults, getAnswerDistribution } from "../../repositories/quiz/quizAnalyticsRepository";
import { getSettings, saveSettings } from "../../repositories/quiz/quizSettingsRepository";
import { buildDetailedReportCsv, buildTraineeSummaryCsv, computeChampions } from "../../services/quiz/quizReportService";
import { downloadCsvFile } from "../../services/quiz/quizCsvService";
import { isCertEligible, MEDALS } from "../../services/quiz/quizRankingService";
import QuizAnswerDistributionBars from "../../components/quiz/QuizAnswerDistributionBars";
import QuizChampionsReveal from "../../components/quiz/QuizChampionsReveal";
import QuizAdminCertificateButton from "../../components/quiz/QuizAdminCertificateButton";
import type {
  QuizSession,
  QuizSessionResultRow,
  AnswerDistributionQuestion,
  ChampionRow,
  ChampMusic,
  CertEligibility,
} from "../../types/quiz";

const GRADE_STYLE: Record<string, string> = {
  PASS: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  NEED_IMPROVEMENT: "text-amber-300 bg-amber-500/15 border-amber-500/30",
  FAIL: "text-red-300 bg-red-500/15 border-red-500/30",
};

function toIsoStart(dateStr: string): string | undefined {
  return dateStr ? new Date(`${dateStr}T00:00:00`).toISOString() : undefined;
}
function toIsoEnd(dateStr: string): string | undefined {
  return dateStr ? new Date(`${dateStr}T23:59:59.999`).toISOString() : undefined;
}
function inRange(iso: string | null, fromIso?: string, toIso?: string): boolean {
  if (!iso) return false;
  if (fromIso && iso < fromIso) return false;
  if (toIso && iso > toIso) return false;
  return true;
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function startOfWeekStr(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}
function startOfMonthStr(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export default function QuizResultsPage() {
  const admin = getCurrentQuizAdmin();
  const canEdit = canEditQuizContent();

  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [allResults, setAllResults] = useState<QuizSessionResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [expanded, setExpanded] = useState<string | null>(null);
  const [distributions, setDistributions] = useState<Record<string, AnswerDistributionQuestion[]>>({});

  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");

  const [champFrom, setChampFrom] = useState("");
  const [champTo, setChampTo] = useState("");
  const [qualifyPct, setQualifyPct] = useState(60);
  const [periodTitle, setPeriodTitle] = useState("");
  const [revealChampions, setRevealChampions] = useState<ChampionRow[] | null>(null);

  const [certEligibility, setCertEligibility] = useState<CertEligibility>("all_pass");
  const [musicChoice, setMusicChoice] = useState<ChampMusic>("builtin");
  const [musicUrl, setMusicUrl] = useState("");
  const [musicVolume, setMusicVolume] = useState(70);
  const [musicSaving, setMusicSaving] = useState(false);
  const [musicMessage, setMusicMessage] = useState("");

  const [perfTrainee, setPerfTrainee] = useState("");
  const [perfFrom, setPerfFrom] = useState("");
  const [perfTo, setPerfTo] = useState("");

  function refresh() {
    if (!admin) return;
    setLoading(true);
    Promise.all([
      listSessionsForCompany(admin.company_id),
      getCompanySessionResults(admin.company_id),
      getSettings(admin.company_id),
    ])
      .then(([s, r, settings]) => {
        setSessions(s.filter((x) => x.phase === "ended"));
        setAllResults(r);
        setCertEligibility(settings.cert_eligibility);
        setMusicChoice(settings.champ_music);
        setMusicUrl(settings.champ_music_url ?? "");
        setMusicVolume(settings.champ_music_volume);
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [admin]);

  const traineeNames = useMemo(
    () => [...new Set(allResults.map((r) => r.display_name.trim()))].sort(),
    [allResults]
  );

  const exportFromIso = toIsoStart(exportFrom);
  const exportToIso = toIsoEnd(exportTo);
  const exportRows = useMemo(
    () => allResults.filter((r) => inRange(r.ended_at, exportFromIso, exportToIso)),
    [allResults, exportFromIso, exportToIso]
  );
  const exportSessionCount = useMemo(() => new Set(exportRows.map((r) => r.session_id)).size, [exportRows]);

  const perfFromIso = toIsoStart(perfFrom);
  const perfToIso = toIsoEnd(perfTo);
  const perfRows = useMemo(
    () =>
      allResults
        .filter((r) => inRange(r.ended_at, perfFromIso, perfToIso))
        .filter((r) => !perfTrainee || r.display_name.trim() === perfTrainee)
        .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? "")),
    [allResults, perfFromIso, perfToIso, perfTrainee]
  );

  async function toggle(sessionId: string, quizId: string) {
    if (expanded === sessionId) {
      setExpanded(null);
      return;
    }
    setExpanded(sessionId);
    if (!distributions[sessionId]) {
      const dist = await getAnswerDistribution(sessionId, quizId);
      setDistributions((prev) => ({ ...prev, [sessionId]: dist }));
    }
  }

  async function handleDeleteSession(sessionId: string) {
    if (!confirm("Delete this session and all its results? This cannot be undone.")) return;
    try {
      await deleteSession(sessionId);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete session.");
    }
  }

  async function handleDeleteAll() {
    if (!admin) return;
    if (!confirm("Delete ALL quiz sessions and results for your company? This cannot be undone.")) return;
    try {
      await deleteAllSessions(admin.company_id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete all sessions.");
    }
  }

  function handleDetailedReport() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`quiz-detailed-report-${stamp}.csv`, buildDetailedReportCsv(exportRows));
  }

  function handleTraineeSummary() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`quiz-trainee-summary-${stamp}.csv`, buildTraineeSummaryCsv(exportRows));
  }

  function handlePerformanceDownload() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`quiz-performance-${stamp}.csv`, buildDetailedReportCsv(perfRows));
  }

  function applyQuickFilter(kind: "lastWeek" | "lastMonth" | "thisWeek" | "thisMonth") {
    const today = todayStr();
    if (kind === "thisWeek") {
      setChampFrom(startOfWeekStr());
      setChampTo(today);
    } else if (kind === "thisMonth") {
      setChampFrom(startOfMonthStr());
      setChampTo(today);
    } else if (kind === "lastWeek") {
      setChampFrom(daysAgoStr(14));
      setChampTo(daysAgoStr(7));
    } else {
      setChampFrom(daysAgoStr(60));
      setChampTo(daysAgoStr(30));
    }
  }

  function handleReveal() {
    const fromIso = toIsoStart(champFrom);
    const toIso = toIsoEnd(champTo);
    const rows = allResults.filter((r) => inRange(r.ended_at, fromIso, toIso));
    setRevealChampions(computeChampions(rows, qualifyPct));
  }

  async function handleSaveMusic() {
    if (!admin) return;
    setMusicSaving(true);
    setMusicMessage("");
    try {
      await saveSettings(admin.company_id, {
        champ_music: musicChoice,
        champ_music_url: musicUrl.trim() || null,
        champ_music_volume: musicVolume,
      });
      setMusicMessage("Saved.");
    } finally {
      setMusicSaving(false);
    }
  }

  if (loading) return <div className="text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Results &amp; Analytics</h1>
          <p className="text-sm text-slate-400 mt-0.5">Past quiz session results</p>
        </div>
        {canEdit && sessions.length > 0 && (
          <button
            onClick={handleDeleteAll}
            className="text-xs font-semibold text-red-300 hover:text-red-200 border border-red-900/50 rounded-lg px-3 py-1.5"
          >
            🗑 Delete All
          </button>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
      )}

      {/* Export Reports */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-white">📄 Export Reports (Excel/CSV)</h2>
        <p className="text-xs text-slate-500">Choose a date range — leave blank for all time</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-400">From</label>
          <input
            type="date"
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            value={exportFrom}
            onChange={(e) => setExportFrom(e.target.value)}
          />
          <label className="text-xs text-slate-400">To</label>
          <input
            type="date"
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            value={exportTo}
            onChange={(e) => setExportTo(e.target.value)}
          />
          <button
            onClick={handleDetailedReport}
            disabled={exportRows.length === 0}
            className="text-sm font-semibold bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-amber-950 rounded-lg px-4 py-2"
          >
            📄 Detailed Report
          </button>
          <button
            onClick={handleTraineeSummary}
            disabled={exportRows.length === 0}
            className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg px-4 py-2"
          >
            👤 Trainee Summary
          </button>
        </div>
        <div className="text-xs text-emerald-300">
          ✅ {exportSessionCount} session{exportSessionCount === 1 ? "" : "s"} · {exportRows.length} trainee entries in range
        </div>
      </div>

      {/* Champions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-white">🏆 Weekly / Monthly Champions</h2>
        <p className="text-xs text-slate-500">Filter by date → top 3 PASS trainees → TV reveal with fireworks + certificates</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => applyQuickFilter("lastWeek")} className="text-xs font-semibold text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5">
            📅 Last Week
          </button>
          <button onClick={() => applyQuickFilter("lastMonth")} className="text-xs font-semibold text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5">
            📅 Last Month
          </button>
          <button onClick={() => applyQuickFilter("thisWeek")} className="text-xs font-semibold text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5">
            📅 This Week
          </button>
          <button onClick={() => applyQuickFilter("thisMonth")} className="text-xs font-semibold text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5">
            📅 This Month
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-400">From</label>
          <input type="date" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500" value={champFrom} onChange={(e) => setChampFrom(e.target.value)} />
          <label className="text-xs text-slate-400">To</label>
          <input type="date" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500" value={champTo} onChange={(e) => setChampTo(e.target.value)} />
          <label className="text-xs text-slate-400">Qualify at</label>
          <input
            type="number"
            min={0}
            max={100}
            className="w-20 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            value={qualifyPct}
            onChange={(e) => setQualifyPct(Number(e.target.value))}
          />
          <span className="text-xs text-slate-400">% or above</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            className="flex-1 min-w-[12rem] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            placeholder="Period title (e.g. Week 2 · June 2026)"
            value={periodTitle}
            onChange={(e) => setPeriodTitle(e.target.value)}
          />
          <button
            onClick={handleReveal}
            className="text-sm font-semibold bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-lg px-4 py-2"
          >
            📺 Reveal on TV
          </button>
        </div>

        {/* Background music */}
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">🎵 Background Music</div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              disabled={!canEdit}
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-50"
              value={musicChoice}
              onChange={(e) => setMusicChoice(e.target.value as ChampMusic)}
            >
              <option value="builtin">🎺 Built-in (fanfare + clapping)</option>
              <option value="custom">🔗 Custom URL</option>
              <option value="off">🔇 Off</option>
            </select>
            {musicChoice === "custom" && (
              <input
                disabled={!canEdit}
                className="flex-1 min-w-[14rem] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-50"
                placeholder="https://… (mp3/ogg URL)"
                value={musicUrl}
                onChange={(e) => setMusicUrl(e.target.value)}
              />
            )}
            <input
              disabled={!canEdit}
              type="range"
              min={0}
              max={100}
              value={musicVolume}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
              className="w-32 disabled:opacity-50"
            />
            {canEdit && (
              <button
                onClick={handleSaveMusic}
                disabled={musicSaving}
                className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg px-4 py-2"
              >
                💾 {musicSaving ? "Saving…" : "Save"}
              </button>
            )}
            {musicMessage && <span className="text-xs text-emerald-300">{musicMessage}</span>}
          </div>
        </div>
      </div>

      {/* Performance table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-white">📈 Performance</h2>
            <p className="text-xs text-slate-500">Name &amp; date wise scores with percentage — full test details</p>
          </div>
          <button
            onClick={handlePerformanceDownload}
            disabled={perfRows.length === 0}
            className="text-sm font-semibold bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-amber-950 rounded-lg px-4 py-2"
          >
            ⬇ Download Excel/CSV
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            value={perfTrainee}
            onChange={(e) => setPerfTrainee(e.target.value)}
          >
            <option value="">All trainees</option>
            {traineeNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <input type="date" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500" value={perfFrom} onChange={(e) => setPerfFrom(e.target.value)} />
          <span className="text-xs text-slate-500">to</span>
          <input type="date" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500" value={perfTo} onChange={(e) => setPerfTo(e.target.value)} />
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 sticky top-0">
              <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Test Name</th>
                <th className="px-3 py-2">Trainee</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Correct</th>
                <th className="px-3 py-2">%</th>
                <th className="px-3 py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {perfRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    No results in range.
                  </td>
                </tr>
              ) : (
                perfRows.map((r) => (
                  <tr key={`${r.session_id}-${r.participant_id}`} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-300">{r.ended_at ? new Date(r.ended_at).toLocaleDateString("en-IN") : ""}</td>
                    <td className="px-3 py-2 text-white font-medium max-w-xs truncate">{r.quiz_title}</td>
                    <td className="px-3 py-2 text-white font-medium">{r.display_name}</td>
                    <td className="px-3 py-2 font-mono text-slate-300">{r.score}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {r.correct_count}/{r.total_questions}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-300">{r.percent_correct}%</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${GRADE_STYLE[r.grade]}`}>
                        {r.grade.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session list */}
      {sessions.length === 0 ? (
        <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          No sessions yet. Launch a quiz to see results.
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const rows = allResults.filter((r) => r.session_id === s.id);
            const nPass = rows.filter((r) => r.grade === "PASS").length;
            const nImp = rows.filter((r) => r.grade === "NEED_IMPROVEMENT").length;
            const nFail = rows.filter((r) => r.grade === "FAIL").length;
            const isOpen = expanded === s.id;

            return (
              <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3">
                  <button className="flex-1 text-left flex items-center justify-between" onClick={() => toggle(s.id, s.quiz_id)}>
                    <div>
                      <div className="font-semibold text-sm text-white">{rows[0]?.quiz_title ?? "Quiz session"}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {s.ended_at ? new Date(s.ended_at).toLocaleString("en-IN") : ""} · {rows.length} participant{rows.length === 1 ? "" : "s"}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">✅ {nPass} Pass</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">⚠ {nImp} Improve</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-500/15 text-red-300">✗ {nFail} Fail</span>
                      </div>
                    </div>
                    <span className="text-slate-500 ml-3">{isOpen ? "▲" : "▼"}</span>
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handleDeleteSession(s.id)}
                      className="text-xs font-semibold text-red-300 hover:text-red-200 border border-red-900/50 rounded-lg px-2.5 py-1.5"
                    >
                      🗑
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-5">
                    {rows.length === 0 ? (
                      <div className="text-xs text-slate-500">No participants.</div>
                    ) : (
                      rows
                        .slice()
                        .sort((a, b) => a.rank - b.rank)
                        .map((r) => (
                          <div key={r.participant_id} className="flex items-center gap-3 bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
                            <span className="font-mono text-xs text-slate-500 w-6 shrink-0">{MEDALS[r.rank - 1] ?? `#${r.rank}`}</span>
                            <span className="flex-1 truncate">{r.display_name}</span>
                            <span className="text-xs text-slate-400">
                              {r.correct_count}/{r.total_questions} · {r.percent_correct}%
                            </span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${GRADE_STYLE[r.grade]}`}>
                              {r.grade.replace("_", " ")}
                            </span>
                            {isCertEligible(r.rank, r.grade, certEligibility) && admin && (
                              <QuizAdminCertificateButton participantId={r.participant_id} companyId={admin.company_id} />
                            )}
                          </div>
                        ))
                    )}

                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                        📊 Answer Breakdown
                      </div>
                      {distributions[s.id] ? (
                        <QuizAnswerDistributionBars questions={distributions[s.id]} />
                      ) : (
                        <div className="text-xs text-slate-500">Loading…</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {revealChampions && (
        <QuizChampionsReveal
          champions={revealChampions}
          periodTitle={periodTitle}
          music={musicChoice}
          musicUrl={musicUrl || null}
          musicVolume={musicVolume}
          onClose={() => setRevealChampions(null)}
        />
      )}
    </div>
  );
}
