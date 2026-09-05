import { useEffect, useState } from "react";

import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { listSessionsForCompany, deleteSession } from "../../repositories/quiz/quizSessionRepository";
import { getCompanySessionResults, getAnswerDistribution } from "../../repositories/quiz/quizAnalyticsRepository";
import { getSettings } from "../../repositories/quiz/quizSettingsRepository";
import {
  listFoldersForCompany,
  createFolder,
  renameFolder,
  deleteFolder,
  moveSessionToFolder,
} from "../../repositories/quiz/quizResultFolderRepository";
import { buildDetailedReportCsv } from "../../services/quiz/quizReportService";
import { downloadCsvFile } from "../../services/quiz/quizCsvService";
import SessionResultCard from "../../components/quiz/SessionResultCard";
import type { QuizSession, QuizSessionResultRow, QuizResultFolder, AnswerDistributionQuestion, CertEligibility } from "../../types/quiz";

/** A permanent, organized home for final-test sessions — separate from
 * the everyday practice-session list on the Results tab. Moving a
 * session in here (from Results) is what takes it off that everyday
 * list; everything here (create/rename/delete folders, drill into one's
 * sessions, per-folder CSV export) lives on its own tab so it doesn't
 * get lost among Results' Export/Champions/Performance sections. */
export default function QuizFinalResultPage() {
  const admin = getCurrentQuizAdmin();
  const canEdit = canEditQuizContent();

  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [allResults, setAllResults] = useState<QuizSessionResultRow[]>([]);
  const [folders, setFolders] = useState<QuizResultFolder[]>([]);
  const [certEligibility, setCertEligibility] = useState<CertEligibility>("all_pass");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [expanded, setExpanded] = useState<string | null>(null);
  const [distributions, setDistributions] = useState<Record<string, AnswerDistributionQuestion[]>>({});

  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [folderBusy, setFolderBusy] = useState(false);

  function refresh() {
    if (!admin) return;
    setLoading(true);
    Promise.all([
      listSessionsForCompany(admin.company_id),
      getCompanySessionResults(admin.company_id),
      getSettings(admin.company_id),
      listFoldersForCompany(admin.company_id),
    ])
      .then(([s, r, settings, f]) => {
        setSessions(s.filter((x) => x.phase === "ended"));
        setAllResults(r);
        setCertEligibility(settings.cert_eligibility);
        setFolders(f);
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [admin]);

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

  async function handleCreateFolder() {
    if (!admin || !newFolderName.trim()) return;
    setFolderBusy(true);
    try {
      await createFolder(admin.company_id, newFolderName.trim(), admin.id);
      setNewFolderName("");
      setShowNewFolderForm(false);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create folder.");
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleRenameFolder(folderId: string) {
    if (!renameValue.trim()) return;
    setFolderBusy(true);
    try {
      await renameFolder(folderId, renameValue.trim());
      setRenamingFolderId(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename folder.");
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleDeleteFolder(folderId: string) {
    if (!confirm("Delete this folder? It must be empty — move any sessions out first.")) return;
    try {
      await deleteFolder(folderId);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete folder.");
    }
  }

  async function handleRemoveFromFolder(sessionId: string) {
    setFolderBusy(true);
    try {
      await moveSessionToFolder(sessionId, null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to move session.");
    } finally {
      setFolderBusy(false);
    }
  }

  function handleFolderDownload(folderName: string, rows: QuizSessionResultRow[]) {
    const stamp = new Date().toISOString().slice(0, 10);
    const safeName = folderName.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "batch";
    downloadCsvFile(`quiz-${safeName}-${stamp}.csv`, buildDetailedReportCsv(rows));
  }

  if (loading) return <div className="text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="text-xl font-bold text-white">📁 Final Result</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Move a final test's session in here from Results to keep a permanent, organized record — it stops showing in the everyday session list there.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-white">Folders</h2>
          {canEdit && (
            <button
              onClick={() => setShowNewFolderForm((v) => !v)}
              className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2"
            >
              + New Folder
            </button>
          )}
        </div>

        {showNewFolderForm && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              className="flex-1 min-w-[12rem] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              placeholder="e.g. Batch No 12"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
              }}
            />
            <button
              onClick={handleCreateFolder}
              disabled={folderBusy || !newFolderName.trim()}
              className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg px-4 py-2"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowNewFolderForm(false);
                setNewFolderName("");
              }}
              className="text-sm font-semibold text-slate-400 hover:text-slate-200 px-3 py-2"
            >
              Cancel
            </button>
          </div>
        )}

        {folders.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No batch folders yet — go to Results, move a final test's session in, and it'll show up here.
          </div>
        ) : (
          <div className="space-y-3">
            {folders.map((f) => {
              const folderSessions = sessions.filter((s) => s.folder_id === f.id);
              const folderRows = allResults.filter((r) => r.folder_id === f.id);
              const isFolderOpen = expandedFolder === f.id;
              const isRenaming = renamingFolderId === f.id;

              return (
                <div key={f.id} className="border border-slate-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between gap-3 p-4 bg-slate-950/40">
                    {isRenaming ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          autoFocus
                          className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameFolder(f.id);
                          }}
                        />
                        <button
                          onClick={() => handleRenameFolder(f.id)}
                          disabled={folderBusy || !renameValue.trim()}
                          className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button onClick={() => setRenamingFolderId(null)} className="text-xs font-semibold text-slate-400 hover:text-slate-200">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="flex-1 text-left flex items-center gap-2"
                        onClick={() => setExpandedFolder(isFolderOpen ? null : f.id)}
                      >
                        <span className="text-lg">📁</span>
                        <span className="font-semibold text-sm text-white">{f.name}</span>
                        <span className="text-xs text-slate-500">
                          {folderSessions.length} session{folderSessions.length === 1 ? "" : "s"}
                        </span>
                        <span className="text-slate-500 ml-auto">{isFolderOpen ? "▲" : "▼"}</span>
                      </button>
                    )}
                    {canEdit && !isRenaming && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setRenamingFolderId(f.id);
                            setRenameValue(f.name);
                          }}
                          className="text-xs font-semibold text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteFolder(f.id)}
                          className="text-xs font-semibold text-red-300 hover:text-red-200 border border-red-900/50 rounded-lg px-2.5 py-1.5"
                        >
                          🗑
                        </button>
                      </div>
                    )}
                  </div>

                  {isFolderOpen && (
                    <div className="p-4 space-y-3 border-t border-slate-800">
                      {folderRows.length > 0 && (
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleFolderDownload(f.name, folderRows)}
                            className="text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-lg px-3 py-1.5"
                          >
                            ⬇ Download this batch's record
                          </button>
                        </div>
                      )}
                      {folderSessions.length === 0 ? (
                        <div className="text-xs text-slate-500 text-center py-4">Empty — move a session in from Results.</div>
                      ) : (
                        folderSessions.map((s) => {
                          const rows = allResults.filter((r) => r.session_id === s.id);
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
                                canEdit ? (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => handleRemoveFromFolder(s.id)}
                                      disabled={folderBusy}
                                      className="text-xs font-semibold text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 disabled:opacity-40"
                                    >
                                      ↩ Remove from Folder
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSession(s.id)}
                                      className="text-xs font-semibold text-red-300 hover:text-red-200 border border-red-900/50 rounded-lg px-2.5 py-1.5"
                                    >
                                      🗑
                                    </button>
                                  </div>
                                ) : undefined
                              }
                            />
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
