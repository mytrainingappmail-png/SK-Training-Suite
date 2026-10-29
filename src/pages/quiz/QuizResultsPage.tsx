import { useEffect, useMemo, useState } from "react";

import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { listSessionsForCompany, deleteSession, deleteSessions, deleteAllSessions } from "../../repositories/quiz/quizSessionRepository";
import { getCompanySessionResults, getAnswerDistribution } from "../../repositories/quiz/quizAnalyticsRepository";
import { getSettings, saveSettings } from "../../repositories/quiz/quizSettingsRepository";
import { listFoldersForCompany, createFolder } from "../../repositories/quiz/quizResultFolderRepository";
import { saveSessionToFinalResult, listSavedSessionFolders } from "../../repositories/quiz/quizFinalResultRepository";
import { buildDetailedReportCsv, buildTraineeSummaryCsv, computeChampions } from "../../services/quiz/quizReportService";
import { downloadCsvFile } from "../../services/quiz/quizCsvService";
import QuizChampionsReveal from "../../components/quiz/QuizChampionsReveal";
import SessionResultCard from "../../components/quiz/SessionResultCard";
import GradeBadge from "../../components/quiz/GradeBadge";
import SelectedResultsModal from "../../components/quiz/SelectedResultsModal";
import TopicReportModal from "../../components/quiz/TopicReportModal";
import { loadQuizTopicInputs } from "../../repositories/quiz/quizTopicRepository";
import { loadRankTitleConfig } from "../../hooks/quiz/useRankTitleConfig";
import { useQuizLocation, matchesQuizLocation } from "../../services/quiz/quizLocationStore";
import type {
  QuizSession,
  QuizSessionResultRow,
  QuizResultFolder,
  AnswerDistributionQuestion,
  ChampionRow,
  ChampMusic,
  CertEligibility,
} from "../../types/quiz";

function toIsoStart(dateStr: string, timeStr = ""): string | undefined {
  return dateStr ? new Date(`${dateStr}T${timeStr || "00:00"}:00`).toISOString() : undefined;
}
function toIsoEnd(dateStr: string, timeStr = ""): string | undefined {
  return dateStr ? new Date(`${dateStr}T${timeStr || "23:59"}:59.999`).toISOString() : undefined;
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
  // two tests on one day: the time narrows it down, and a test can be un-ticked from the list below
  const [exportFromTime, setExportFromTime] = useState("");
  const [exportToTime, setExportToTime] = useState("");
  const [excludedExport, setExcludedExport] = useState<Set<string>>(new Set());
  const [viewOpen, setViewOpen] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);

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

  // Just enough Final Result data to power the per-session "Move to
  // folder" action below — full folder management (create/rename/
  // delete/drill-in) lives on its own Final Result tab.
  const [folders, setFolders] = useState<QuizResultFolder[]>([]);
  const [movingSessionId, setMovingSessionId] = useState<string | null>(null);
  const [moveNewFolderName, setMoveNewFolderName] = useState("");
  const [folderBusy, setFolderBusy] = useState(false);
  // session id -> Final Result folder id, for sessions that already have a saved copy
  const [savedFolders, setSavedFolders] = useState<Map<string, string>>(new Map());
  const [savedNotice, setSavedNotice] = useState("");

  // Bulk-select in the everyday Session list (not the Final Result folders)
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [bulkDeletingSessions, setBulkDeletingSessions] = useState(false);

  function refresh() {
    if (!admin) return;
    setLoading(true);
    Promise.all([
      listSessionsForCompany(admin.company_id),
      getCompanySessionResults(admin.company_id),
      getSettings(admin.company_id),
      listFoldersForCompany(admin.company_id),
      listSavedSessionFolders(admin.company_id).catch(() => new Map<string, string>()),
    ])
      .then(([s, r, settings, f, saved]) => {
        setSavedFolders(saved);
        setSessions(s.filter((x) => x.phase === "ended"));
        setAllResults(r);
        setCertEligibility(settings.cert_eligibility);
        setMusicChoice(settings.champ_music);
        setMusicUrl(settings.champ_music_url ?? "");
        setMusicVolume(settings.champ_music_volume);
        setFolders(f);
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [admin]);

  // Everyday views (session list, Performance table, exports, Champions)
  // only ever see sessions that haven't been moved into a Batch Records
  // folder — that's the whole point of moving one in: it stops showing up
  // in the day-to-day clutter and lives only inside its folder from then on.
  // The 📍 switch at the top also narrows these everyday views to one location's sessions.
  const { selectedId: locationFilter } = useQuizLocation();
  const unfiledSessions = useMemo(() => sessions.filter((s) => !s.folder_id && matchesQuizLocation(s.location_id, locationFilter)), [sessions, locationFilter]);
  const unfiledResults = useMemo(() => allResults.filter((r) => !r.folder_id && matchesQuizLocation(r.location_id, locationFilter)), [allResults, locationFilter]);

  const traineeNames = useMemo(
    () => [...new Set(unfiledResults.map((r) => r.display_name.trim()))].sort(),
    [unfiledResults]
  );

  const exportFromIso = toIsoStart(exportFrom, exportFromTime);
  const exportToIso = toIsoEnd(exportTo, exportToTime);
  const exportRangeRows = useMemo(
    () => unfiledResults.filter((r) => inRange(r.ended_at, exportFromIso, exportToIso)),
    [unfiledResults, exportFromIso, exportToIso]
  );
  // the tests that fall in the range (oldest first), so it is clear which ones a download will contain
  const exportSessions = useMemo(() => {
    const map = new Map<string, { id: string; title: string; endedAt: string; count: number }>();
    for (const r of exportRangeRows) {
      const known = map.get(r.session_id);
      if (known) known.count += 1;
      else map.set(r.session_id, { id: r.session_id, title: r.quiz_title, endedAt: r.ended_at ?? "", count: 1 });
    }
    return [...map.values()].sort((a, b) => a.endedAt.localeCompare(b.endedAt));
  }, [exportRangeRows]);
  const exportRows = useMemo(() => exportRangeRows.filter((r) => !excludedExport.has(r.session_id)), [exportRangeRows, excludedExport]);
  const exportSessionCount = useMemo(() => new Set(exportRows.map((r) => r.session_id)).size, [exportRows]);

  const perfFromIso = toIsoStart(perfFrom);
  const perfToIso = toIsoEnd(perfTo);
  const perfRows = useMemo(
    () =>
      unfiledResults
        .filter((r) => inRange(r.ended_at, perfFromIso, perfToIso))
        .filter((r) => !perfTrainee || r.display_name.trim() === perfTrainee)
        .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? "")),
    [unfiledResults, perfFromIso, perfToIso, perfTrainee]
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
    if (!confirm("Delete this session and all its results? Copies already saved in Final Result are not affected. This cannot be undone.")) return;
    try {
      await deleteSession(sessionId);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete session.");
    }
  }

  async function handleDeleteAll() {
    if (!admin) return;
    if (!confirm("Delete ALL quiz sessions and results for your company? Copies already saved in Final Result are not affected. This cannot be undone.")) return;
    try {
      await deleteAllSessions(admin.company_id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete all sessions.");
    }
  }

  function toggleSessionSelected(sessionId: string) {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  function selectAllSessions() {
    setSelectedSessionIds(new Set(unfiledSessions.map((s) => s.id)));
  }

  async function handleBulkDeleteSessions() {
    if (selectedSessionIds.size === 0) return;
    if (!confirm(`Delete ${selectedSessionIds.size} session(s) and all their results? Copies already saved in Final Result are not affected. This cannot be undone.`)) return;
    setBulkDeletingSessions(true);
    setError("");
    try {
      await deleteSessions([...selectedSessionIds]);
      setSelectedSessionIds(new Set());
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete the selected sessions.");
    } finally {
      setBulkDeletingSessions(false);
    }
  }

  /** Saves a separate, frozen copy of this session into a Final Result folder. The session itself stays here and
   * can be deleted any time without touching the saved copy (and vice versa). */
  async function saveCopy(sessionId: string, folderId: string, folderName: string) {
    if (!admin) return;
    const session = sessions.find((x) => x.id === sessionId);
    if (!session) throw new Error("Session not found.");
    const rows = allResults.filter((r) => r.session_id === sessionId);
    const distribution = distributions[sessionId] ?? (await getAnswerDistribution(sessionId, session.quiz_id));
    await saveSessionToFinalResult(admin.company_id, admin.id, session, rows, distribution, folderId);
    setSavedNotice(`Saved to Final Result → ${folderName}. This is a separate copy — deleting the session here won't remove it.`);
    setTimeout(() => setSavedNotice(""), 6000);
  }

  async function handleMoveToFolder(sessionId: string, folderId: string | null) {
    if (!folderId) return;
    setFolderBusy(true);
    try {
      await saveCopy(sessionId, folderId, folders.find((f) => f.id === folderId)?.name ?? "folder");
      setMovingSessionId(null);
      setMoveNewFolderName("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save to Final Result.");
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleCreateAndMove(sessionId: string) {
    if (!admin || !moveNewFolderName.trim()) return;
    setFolderBusy(true);
    try {
      const folder = await createFolder(admin.company_id, moveNewFolderName.trim(), admin.id);
      await saveCopy(sessionId, folder.id, folder.name);
      setMovingSessionId(null);
      setMoveNewFolderName("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create folder and move session.");
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleDetailedReport() {
    const stamp = new Date().toISOString().slice(0, 10);
    const titles = admin ? await loadRankTitleConfig(admin.company_id) : null;
    downloadCsvFile(`quiz-detailed-report-${stamp}.csv`, buildDetailedReportCsv(exportRows, titles));
  }

  const selectedResultRows = useMemo(() => allResults.filter((r) => selectedSessionIds.has(r.session_id)), [allResults, selectedSessionIds]);

  async function handleDownloadSelected() {
    const stamp = new Date().toISOString().slice(0, 10);
    const titles = admin ? await loadRankTitleConfig(admin.company_id) : null;
    downloadCsvFile(`quiz-results-${stamp}.csv`, buildDetailedReportCsv(selectedResultRows, titles));
  }

  function handleTraineeSummary() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`quiz-trainee-summary-${stamp}.csv`, buildTraineeSummaryCsv(exportRows));
  }

  async function handlePerformanceDownload() {
    const stamp = new Date().toISOString().slice(0, 10);
    const titles = admin ? await loadRankTitleConfig(admin.company_id) : null;
    downloadCsvFile(`quiz-performance-${stamp}.csv`, buildDetailedReportCsv(perfRows, titles));
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
    const rows = unfiledResults.filter((r) => inRange(r.ended_at, fromIso, toIso));
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
      {savedNotice && (
        <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">✅ {savedNotice}</div>
      )}

      {/* Export Reports */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-white">📄 Export Reports (Excel/CSV)</h2>
        <p className="text-xs text-slate-500">Choose a date range — leave blank for all time. Two tests on the same day? Add a time too, or untick the one you do not want below.</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-400">From</label>
          <input
            type="date"
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            value={exportFrom}
            onChange={(e) => setExportFrom(e.target.value)}
          />
          <input
            type="time"
            title="From time (optional)"
            disabled={!exportFrom}
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-40"
            value={exportFromTime}
            onChange={(e) => setExportFromTime(e.target.value)}
          />
          <label className="text-xs text-slate-400">To</label>
          <input
            type="date"
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            value={exportTo}
            onChange={(e) => setExportTo(e.target.value)}
          />
          <input
            type="time"
            title="To time (optional)"
            disabled={!exportTo}
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-40"
            value={exportToTime}
            onChange={(e) => setExportToTime(e.target.value)}
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
        {exportSessions.length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
            <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tests in this range (untick to leave one out)</div>
            <div className="max-h-44 space-y-0.5 overflow-y-auto">
              {exportSessions.map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-800/60">
                  <input
                    type="checkbox"
                    checked={!excludedExport.has(t.id)}
                    onChange={() =>
                      setExcludedExport((prev) => {
                        const next = new Set(prev);
                        if (next.has(t.id)) next.delete(t.id);
                        else next.add(t.id);
                        return next;
                      })
                    }
                  />
                  <span className="shrink-0 font-mono text-slate-300">
                    {t.endedAt ? new Date(t.endedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }) : ""}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-white">{t.title}</span>
                  <span className="shrink-0 text-slate-500">{t.count} trainee{t.count === 1 ? "" : "s"}</span>
                </label>
              ))}
            </div>
          </div>
        )}
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
                      <span title={`${r.correct_count} of ${r.total_questions} questions correct`}>
                        {r.marks_obtained != null ? `${r.marks_obtained}/${r.total_marks} marks` : `${r.correct_count}/${r.total_questions}`}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-300">{r.percent_correct}%</td>
                    <td className="px-3 py-2">
                      <GradeBadge grade={r.grade} rank={r.rank} isOpenLink={!!r.open_link_id} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session list */}
      {unfiledSessions.length === 0 ? (
        <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          No sessions yet. Launch a quiz to see results.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={selectAllSessions}
              className="text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-3 py-1.5"
            >
              ☑ Select All ({unfiledSessions.length})
            </button>
            <span className="text-[11px] text-slate-500">Tick a result to view it or download it.</span>
          </div>

          {unfiledSessions.map((s) => {
            const rows = allResults.filter((r) => r.session_id === s.id);
            const isMoveOpen = movingSessionId === s.id;

            return (
              <SessionResultCard
                key={s.id}
                session={s}
                rows={rows}
                isOpen={expanded === s.id}
                onToggle={() => toggle(s.id, s.quiz_id)}
                distribution={distributions[s.id]}
                certEligibility={certEligibility}
                companyId={admin?.company_id ?? null}
                actions={
                  (
                    <div className="relative flex items-center gap-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedSessionIds.has(s.id)}
                        onChange={() => toggleSessionSelected(s.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mr-1 h-5 w-5 accent-violet-500"
                        aria-label="Select this session"
                      />
                      {canEdit && (<>
                      <button
                        onClick={() => {
                          setMovingSessionId(isMoveOpen ? null : s.id);
                          setMoveNewFolderName("");
                        }}
                        className="text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-2.5 py-1.5"
                      >
                        {savedFolders.has(s.id) ? "✓ In Final Result" : "📁 Save to Final Result"}
                      </button>
                      <button
                        onClick={() => handleDeleteSession(s.id)}
                        className="text-xs font-semibold text-red-300 hover:text-red-200 border border-red-900/50 rounded-lg px-2.5 py-1.5"
                      >
                        🗑
                      </button>

                      {isMoveOpen && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-60 rounded-xl border border-slate-700 bg-slate-800 py-1.5 shadow-xl">
                          <div className="px-3 py-1 text-xs font-semibold text-slate-400">Save a copy to Final Result folder</div>
                          {folders.length === 0 ? (
                            <div className="px-3 py-1.5 text-xs text-slate-500">No folders yet.</div>
                          ) : (
                            folders.map((f) => (
                              <button
                                key={f.id}
                                onClick={() => handleMoveToFolder(s.id, f.id)}
                                disabled={folderBusy}
                                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-40"
                              >
                                📁 {f.name}{savedFolders.get(s.id) === f.id ? " ✓" : ""}
                              </button>
                            ))
                          )}
                          <div className="my-1 border-t border-slate-700" />
                          <div className="px-3 py-2 flex gap-1.5">
                            <input
                              className="flex-1 min-w-0 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white outline-none focus:border-violet-500"
                              placeholder="New folder…"
                              value={moveNewFolderName}
                              onChange={(e) => setMoveNewFolderName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleCreateAndMove(s.id);
                              }}
                            />
                            <button
                              onClick={() => handleCreateAndMove(s.id)}
                              disabled={folderBusy || !moveNewFolderName.trim()}
                              className="text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg px-2.5"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                      </>)}
                    </div>
                  )
                }
              />
            );
          })}
        </div>
      )}

      {selectedSessionIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 w-[92%] max-w-lg -translate-x-1/2 rounded-2xl border border-violet-500 bg-slate-900 p-4 shadow-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-1 text-sm font-semibold text-white">{selectedSessionIds.size} result{selectedSessionIds.size === 1 ? "" : "s"} selected</span>
            <button onClick={() => setViewOpen(true)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">👁 View</button>
            <button onClick={() => void handleDownloadSelected()} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-300">⬇ Download</button>
            <button onClick={() => setTopicsOpen(true)} className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800" title="Which topics the team is weak in">📚 Topics</button>
            {canEdit && (
              <button
                onClick={handleBulkDeleteSessions}
                disabled={bulkDeletingSessions}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {bulkDeletingSessions ? "Deleting…" : "🗑"}
              </button>
            )}
            <button onClick={() => setSelectedSessionIds(new Set())} className="px-1 text-xs text-slate-400 hover:text-white">Clear</button>
          </div>
        </div>
      )}

      {topicsOpen && selectedResultRows.length > 0 && (
        <TopicReportModal
          title={[...new Set(selectedResultRows.map((r) => r.quiz_title))].join(" · ")}
          load={() => loadQuizTopicInputs(selectedResultRows)}
          defaultThreshold={selectedResultRows[0].passing_score_pct}
          onClose={() => setTopicsOpen(false)}
        />
      )}

      {viewOpen && selectedResultRows.length > 0 && (
        <SelectedResultsModal rows={selectedResultRows} onDownload={() => void handleDownloadSelected()} onClose={() => setViewOpen(false)} />
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
