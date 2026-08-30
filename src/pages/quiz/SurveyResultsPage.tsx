import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { getSurveyWithQuestions, fetchSurveyResults, buildResultsCsv, downloadCsvFile } from "../../repositories/survey/surveyRepository";
import type { Survey, SurveyResults, SurveySentiment } from "../../types/survey";

const SENTIMENT_COLOR: Record<SurveySentiment, string> = { positive: "#10B981", neutral: "#94A3B8", negative: "#EF4444" };
const CHOICE_PALETTE = ["#7C3AED", "#2563EB", "#059669", "#D97706", "#DB2777", "#0891B2", "#F43F5E", "#84CC16"];

function scoreColor(score: number): string {
  if (score >= 66) return "#10B981";
  if (score >= 40) return "#D97706";
  return "#EF4444";
}

/** A CSS-only donut — no chart library needed. */
function DonutGauge({ score, size = 120 }: { score: number; size?: number }) {
  const color = scoreColor(score);
  return (
    <div
      className="rounded-full flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} ${score * 3.6}deg, #1E293B 0deg)`,
      }}
    >
      <div className="rounded-full bg-slate-900 flex items-center justify-center" style={{ width: size - 20, height: size - 20 }}>
        <span className="text-xl font-bold" style={{ color }}>{Math.round(score)}%</span>
      </div>
    </div>
  );
}

/** A CSS-only pie for a set of (color, value) slices. */
function PieChart({ slices, size = 96 }: { slices: { color: string; value: number }[]; size?: number }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return <div className="rounded-full bg-slate-800" style={{ width: size, height: size }} />;
  let acc = 0;
  const stops = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const start = (acc / total) * 360;
      acc += s.value;
      const end = (acc / total) * 360;
      return `${s.color} ${start}deg ${end}deg`;
    })
    .join(", ");
  return <div className="rounded-full" style={{ width: size, height: size, background: `conic-gradient(${stops})` }} />;
}

export default function SurveyResultsPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!surveyId) return;
    getSurveyWithQuestions(surveyId)
      .then(async (survey) => {
        if (!survey) {
          setError("Survey not found.");
          return;
        }
        setSurvey(survey);
        const r = await fetchSurveyResults(surveyId, survey.questions);
        setResults(r);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load results."))
      .finally(() => setLoading(false));
  }, [surveyId]);

  function handleDownload() {
    if (!survey || !results) return;
    downloadCsvFile(`${survey.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-results.csv`, buildResultsCsv(survey, results));
  }

  if (loading) return <div className="text-slate-500 text-sm">Loading…</div>;
  if (error) return <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>;
  if (!survey || !results) return null;

  const participationPct = results.eligibleCount && results.eligibleCount > 0 ? Math.round((results.totalResponses / results.eligibleCount) * 100) : null;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">{survey.title} — Results</h1>
          <p className="text-sm text-slate-400 mt-0.5">Anonymous — no respondent identity is ever stored</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDownload} disabled={results.totalResponses === 0} className="text-sm font-semibold text-slate-200 border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg px-4 py-2">
            ⬇ Download CSV
          </button>
          <Link to={ROUTES.QUIZ_ADMIN_SURVEYS} className="text-sm font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-4 py-2">
            ← Back
          </Link>
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          {results.overallPositivityScore !== undefined ? (
            <DonutGauge score={results.overallPositivityScore} />
          ) : (
            <div className="h-[120px] w-[120px] rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-500 text-center px-4">No scale/choice data yet</div>
          )}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Overall Positivity</p>
            <p className="text-[11px] text-slate-500 mt-1">Average across every scale &amp; choice question's positive/negative tags — open text isn't scored.</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-2">Responses</p>
          <p className="text-3xl font-bold text-white">{results.totalResponses}</p>
          {participationPct !== null ? (
            <>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden mt-3">
                <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(participationPct, 100)}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">{participationPct}% of {results.eligibleCount} active employees — {Math.max((results.eligibleCount ?? 0) - results.totalResponses, 0)} haven't responded yet</p>
            </>
          ) : (
            <p className="text-xs text-slate-500 mt-2">Employee headcount unavailable for a participation rate.</p>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-2">Status</p>
          <p className="text-sm text-slate-200">{survey.status === "published" ? "🟢 Published" : "⚪ Draft"}</p>
          {survey.closes_at && <p className="text-xs text-slate-400 mt-1">Closes {new Date(survey.closes_at).toLocaleString()}</p>}
        </div>
      </div>

      {results.totalResponses === 0 ? (
        <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-2xl">No responses yet.</div>
      ) : (
        <div className="space-y-4">
          {results.questions.map((qr, i) => (
            <div key={qr.question.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-semibold text-white">Q{i + 1}. {qr.question.question_text}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{qr.totalAnswers} answer{qr.totalAnswers === 1 ? "" : "s"}</p>
                </div>
                {qr.positivityScore !== undefined && (
                  <span className="shrink-0 text-xs font-bold rounded-full px-3 py-1" style={{ backgroundColor: `${scoreColor(qr.positivityScore)}22`, color: scoreColor(qr.positivityScore) }}>
                    {Math.round(qr.positivityScore)}% positive
                  </span>
                )}
              </div>

              {qr.choiceBreakdown && (
                <div className="flex flex-col sm:flex-row gap-5">
                  <PieChart slices={qr.choiceBreakdown.map((c, ci) => ({ color: CHOICE_PALETTE[ci % CHOICE_PALETTE.length], value: c.count }))} />
                  <div className="flex-1 space-y-2.5">
                    {qr.choiceBreakdown.map((c, ci) => {
                      const pct = qr.totalAnswers > 0 ? Math.round((c.count / qr.totalAnswers) * 100) : 0;
                      return (
                        <div key={c.option_id}>
                          <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: CHOICE_PALETTE[ci % CHOICE_PALETTE.length] }} />
                              {c.option_text}
                              <span style={{ color: SENTIMENT_COLOR[c.sentiment] }}>{c.sentiment === "positive" ? "🙂" : c.sentiment === "negative" ? "🙁" : "😐"}</span>
                            </span>
                            <span>{c.count} ({pct}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHOICE_PALETTE[ci % CHOICE_PALETTE.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {qr.averageScale !== undefined && qr.scaleDistribution && (
                <div>
                  <p className="text-sm font-bold mb-3" style={{ color: scoreColor(qr.positivityScore ?? 0) }}>
                    Average: {qr.averageScale.toFixed(1)} / {qr.question.scale_max}
                  </p>
                  <div className="flex items-end gap-2 h-24">
                    {qr.scaleDistribution.map((d) => {
                      const maxCount = Math.max(...qr.scaleDistribution!.map((x) => x.count), 1);
                      const heightPct = (d.count / maxCount) * 100;
                      return (
                        <div key={d.value} className="flex-1 flex flex-col items-center justify-end gap-1">
                          <span className="text-[10px] text-slate-400">{d.count}</span>
                          <div className="w-full rounded-t bg-amber-500/70" style={{ height: `${Math.max(heightPct, 4)}%` }} />
                          <span className="text-[10px] font-mono text-slate-500">{d.value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {qr.textAnswers && (
                qr.textAnswers.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No responses yet.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {qr.textAnswers.map((t, ti) => (
                      <p key={ti} className="text-sm text-slate-200 bg-slate-800/60 rounded-lg px-3 py-2">"{t}"</p>
                    ))}
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
