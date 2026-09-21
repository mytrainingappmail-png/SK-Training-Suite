import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { listSurveys, setSurveyStatus, deleteSurvey, getSurveySettings } from "../../repositories/survey/surveyRepository";
import { createSurveySession } from "../../repositories/survey/surveyLiveRepository";
import type { Survey } from "../../types/survey";

export default function SurveyListPage() {
  const admin = getCurrentQuizAdmin();
  const canEdit = canEditQuizContent();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [launchTarget, setLaunchTarget] = useState<Survey | null>(null);
  const [durationText, setDurationText] = useState("5"); // minutes; empty = no limit
  const [presets, setPresets] = useState<number[]>([2, 5, 10, 15, 30]);
  const [startMode, setStartMode] = useState<"now" | "in" | "at">("now");
  const [startInMinutes, setStartInMinutes] = useState("5");
  const [startAtLocal, setStartAtLocal] = useState("");
  const [launching, setLaunching] = useState(false);

  // Duration presets/default come from Survey Settings, not the code.
  useEffect(() => {
    if (!admin) return;
    getSurveySettings(admin.company_id)
      .then((s) => {
        setPresets(s.duration_presets?.length ? s.duration_presets : [2, 5, 10, 15, 30]);
        setDurationText(s.default_duration_minutes ? String(s.default_duration_minutes) : "");
      })
      .catch(() => {});
  }, [admin]);

  function refresh() {
    if (!admin) return;
    setLoading(true);
    listSurveys(admin.company_id).then(setSurveys).finally(() => setLoading(false));
  }

  useEffect(refresh, [admin]);

  const filtered = surveys.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()));

  async function handleTogglePublish(s: Survey) {
    setBusyId(s.id);
    setError("");
    try {
      await setSurveyStatus(s.id, s.status === "published" ? "draft" : "published");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this survey? All responses collected so far will be lost too. This cannot be undone.")) return;
    setBusyId(id);
    try {
      await deleteSurvey(id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete.");
    } finally {
      setBusyId(null);
    }
  }

  function handleCopyLink(s: Survey) {
    const url = `${window.location.origin}${ROUTES.SURVEY_TAKE.replace(":accessCode", s.access_code)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(s.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  async function handleConfirmLaunch() {
    if (!admin || !launchTarget) return;
    setLaunching(true);
    setError("");
    try {
      const minutes = durationText.trim() ? Number(durationText) : null;
      if (minutes !== null && (!Number.isFinite(minutes) || minutes < 1 / 6 || minutes > 1440)) {
        throw new Error("Enter a duration between 10 seconds and 24 hours (in minutes), or leave it empty for no limit.");
      }
      let startInSeconds: number | null = null;
      let startAt: Date | null = null;
      if (startMode === "in") {
        const m = Number(startInMinutes);
        if (!Number.isFinite(m) || m <= 0) throw new Error("Enter how many minutes from now the survey should start.");
        startInSeconds = Math.round(m * 60);
      } else if (startMode === "at") {
        if (!startAtLocal) throw new Error("Pick the date and time the survey should start.");
        startAt = new Date(startAtLocal);
        if (Number.isNaN(startAt.getTime())) throw new Error("That start date/time isn't valid.");
      }
      const session = await createSurveySession(launchTarget.id, {
        timeLimitSeconds: minutes === null ? null : Math.round(minutes * 60),
        startInSeconds,
        startAt,
      });
      setLaunchTarget(null);
      navigate(ROUTES.QUIZ_ADMIN_SURVEY_LIVE_HOST.replace(":surveyId", launchTarget.id).replace(":sessionId", session.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a live session.");
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Surveys</h1>
          <p className="text-sm text-slate-400 mt-0.5">Anonymous opinion-gathering — no score, no right/wrong, nothing shown back to the respondent.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={ROUTES.QUIZ_ADMIN_SURVEY_SETTINGS}
            className="text-sm font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-4 py-2"
          >
            ⚙️ Settings
          </Link>
          {canEdit && (
            <Link
              to={ROUTES.QUIZ_ADMIN_SURVEY_BUILDER_NEW}
              className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2"
            >
              + New Survey
            </Link>
          )}
        </div>
      </div>

      <input
        className="w-full rounded-lg bg-slate-900 border border-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
        placeholder="🔍  Search surveys…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

      {loading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-2xl">No surveys found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
              <span
                className={`w-fit text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded mb-2 ${
                  s.status === "published" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700/50 text-slate-300"
                }`}
              >
                {s.status}
              </span>
              <div className="font-semibold text-white text-sm mb-1">{s.title}</div>
              <div className="text-xs text-slate-500 mb-4 line-clamp-2">{s.description || "No description"}</div>

              <div className="mt-auto flex flex-wrap gap-2 pt-3 border-t border-slate-800">
                {canEdit ? (
                  <Link
                    to={ROUTES.QUIZ_ADMIN_SURVEY_BUILDER_EDIT.replace(":surveyId", s.id)}
                    className="text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-2.5 py-1.5"
                  >
                    ✏️ Edit
                  </Link>
                ) : (
                  <span className="text-xs text-slate-500 italic px-1 py-1.5">View only</span>
                )}
                <Link
                  to={ROUTES.QUIZ_ADMIN_SURVEY_RESULTS.replace(":surveyId", s.id)}
                  className="text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-2.5 py-1.5"
                >
                  📊 Results
                </Link>
                {canEdit && (
                  <button
                    disabled={busyId === s.id}
                    onClick={() => handleTogglePublish(s)}
                    className="text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                  >
                    {s.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                )}
                {s.status === "published" && (
                  <button
                    onClick={() => handleCopyLink(s)}
                    className="text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-lg px-2.5 py-1.5"
                  >
                    {copiedId === s.id ? "✓ Copied" : "🔗 Copy Link"}
                  </button>
                )}
                {s.status === "published" && canEdit && (
                  <button
                    onClick={() => {
                      setLaunchTarget(s);
                      setStartMode("now");
                      setError("");
                    }}
                    className="text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg px-2.5 py-1.5"
                    title="Short-time mode — PIN join, names visible to the host"
                  >
                    🔴 Go Live
                  </button>
                )}
                {canEdit && (
                  <button
                    disabled={busyId === s.id}
                    onClick={() => handleDelete(s.id)}
                    className="text-xs font-semibold text-red-300 hover:text-red-200 border border-red-900/50 rounded-lg px-2.5 py-1.5 disabled:opacity-50 ml-auto"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {launchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white mb-1">Go Live: {launchTarget.title}</h3>
            <p className="text-xs text-slate-400 mb-4">Set how long the survey stays open once it starts, and when it should start. Everyone gets a live countdown.</p>

            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Duration (minutes)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                onClick={() => setDurationText("")}
                className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border-2 ${durationText === "" ? "border-red-500 bg-red-500/10 text-red-300" : "border-slate-700 text-slate-300 hover:border-slate-600"}`}
              >
                No limit
              </button>
              {presets.map((m) => (
                <button
                  key={m}
                  onClick={() => setDurationText(String(m))}
                  className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border-2 ${durationText === String(m) ? "border-red-500 bg-red-500/10 text-red-300" : "border-slate-700 text-slate-300 hover:border-slate-600"}`}
                >
                  {m} min
                </button>
              ))}
            </div>
            <input
              type="number"
              min={0.5}
              step="any"
              value={durationText}
              onChange={(e) => setDurationText(e.target.value)}
              placeholder="or type any number of minutes"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white mb-4"
            />

            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Start</label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {([["now", "Now"], ["in", "In X min"], ["at", "At a time"]] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setStartMode(mode)}
                  className={`text-xs font-semibold rounded-lg px-2 py-2 border-2 ${startMode === mode ? "border-red-500 bg-red-500/10 text-red-300" : "border-slate-700 text-slate-300 hover:border-slate-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {startMode === "in" && (
              <input
                type="number"
                min={0.5}
                step="any"
                value={startInMinutes}
                onChange={(e) => setStartInMinutes(e.target.value)}
                placeholder="minutes from now"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white mb-2"
              />
            )}
            {startMode === "at" && (
              <input
                type="datetime-local"
                value={startAtLocal}
                onChange={(e) => setStartAtLocal(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white mb-2"
              />
            )}
            <div className="mb-4" />

            {error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">{error}</div>}

            <div className="flex gap-2">
              <button onClick={() => setLaunchTarget(null)} className="flex-1 text-sm font-semibold text-slate-300 border border-slate-700 rounded-lg px-4 py-2.5">
                Cancel
              </button>
              <button
                onClick={handleConfirmLaunch}
                disabled={launching}
                className="flex-1 text-sm font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg px-4 py-2.5"
              >
                {launching ? "Starting…" : "🔴 Start Live Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
