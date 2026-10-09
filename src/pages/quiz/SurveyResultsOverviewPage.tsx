import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { getCurrentQuizAdmin } from "../../services/quiz/quizAdminSession";
import {
  listSurveys,
  listSurveyResponseStats,
  getSurveyWithQuestions,
  fetchSurveyResults,
  buildResultsCsv,
  downloadCsvFile,
} from "../../repositories/survey/surveyRepository";
import type { SurveyResponseStat } from "../../repositories/survey/surveyRepository";
import type { Survey } from "../../types/survey";

function when(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** All surveys' results in one place — pick one to open its full report, or download its CSV straight from here. */
export default function SurveyResultsOverviewPage() {
  const admin = getCurrentQuizAdmin();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState<Map<string, SurveyResponseStat>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) return;
    listSurveys(admin.company_id)
      .then(async (list) => {
        setSurveys(list);
        setStats(await listSurveyResponseStats(list.map((s) => s.id)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load survey results."))
      .finally(() => setLoading(false));
  }, [admin]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return surveys
      .filter((s) => s.title.toLowerCase().includes(q))
      .map((s) => ({ survey: s, stat: stats.get(s.id) ?? { surveyId: s.id, responses: 0, lastSubmittedAt: null } }))
      .sort((a, b) => (b.stat.lastSubmittedAt ?? "").localeCompare(a.stat.lastSubmittedAt ?? "") || a.survey.title.localeCompare(b.survey.title));
  }, [surveys, stats, search]);

  const totalResponses = [...stats.values()].reduce((sum, s) => sum + s.responses, 0);
  const withResponses = [...stats.values()].filter((s) => s.responses > 0).length;

  async function handleDownload(s: Survey) {
    setBusyId(s.id);
    setError("");
    try {
      const full = await getSurveyWithQuestions(s.id);
      if (!full) throw new Error("Survey not found.");
      const results = await fetchSurveyResults(s.id, full.questions);
      downloadCsvFile(`${s.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-results.csv`, buildResultsCsv(s, results));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download the results.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Survey Results</h1>
          <p className="text-sm text-slate-400 mt-0.5">Every survey and how many people have answered. Open one for the full report. Anonymous — no respondent identity is stored.</p>
        </div>
        <Link to={ROUTES.QUIZ_ADMIN_SURVEYS} className="text-sm font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-4 py-2">
          ← Back
        </Link>
      </div>

      {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

      {loading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Surveys", value: surveys.length },
              { label: "With responses", value: withResponses },
              { label: "Total responses", value: totalResponses },
            ].map((t) => (
              <div key={t.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">{t.label}</p>
                <p className="text-2xl sm:text-3xl font-bold text-white mt-1">{t.value}</p>
              </div>
            ))}
          </div>

          <input
            className="w-full rounded-lg bg-slate-900 border border-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            placeholder="🔍  Search surveys…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {rows.length === 0 ? (
            <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-2xl">No surveys found.</div>
          ) : (
            <div className="space-y-3">
              {rows.map(({ survey: s, stat }) => (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${s.status === "published" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700/50 text-slate-300"}`}>
                        {s.status}
                      </span>
                      <span className="font-semibold text-white text-sm break-words">{s.title}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Last response: {when(stat.lastSubmittedAt)}</p>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div className="text-center sm:text-right">
                      <p className="text-2xl font-bold text-white leading-none">{stat.responses}</p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-1">response{stat.responses === 1 ? "" : "s"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-auto sm:ml-0">
                      <Link
                        to={ROUTES.QUIZ_ADMIN_SURVEY_RESULTS.replace(":surveyId", s.id)}
                        className="text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg px-3 py-2"
                      >
                        📊 View Results
                      </Link>
                      <button
                        onClick={() => handleDownload(s)}
                        disabled={stat.responses === 0 || busyId === s.id}
                        className="text-xs font-semibold text-slate-200 border border-slate-700 hover:bg-slate-800 disabled:opacity-40 rounded-lg px-3 py-2"
                      >
                        {busyId === s.id ? "Preparing…" : "⬇ CSV"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
