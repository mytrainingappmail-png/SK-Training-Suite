import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { getSurveyWithQuestions, fetchSurveyResults } from "../../repositories/survey/surveyRepository";
import type { Survey, SurveyResults } from "../../types/survey";

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

  if (loading) return <div className="text-slate-500 text-sm">Loading…</div>;
  if (error) return <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>;
  if (!survey || !results) return null;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">{survey.title} — Results</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {results.totalResponses} response{results.totalResponses === 1 ? "" : "s"} · anonymous, no respondent identity is ever stored
          </p>
        </div>
        <Link to={ROUTES.QUIZ_ADMIN_SURVEYS} className="text-sm font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-4 py-2">
          ← Back to Surveys
        </Link>
      </div>

      {results.totalResponses === 0 ? (
        <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-2xl">No responses yet.</div>
      ) : (
        <div className="space-y-4">
          {results.questions.map((qr, i) => (
            <div key={qr.question.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-sm font-semibold text-white mb-1">Q{i + 1}. {qr.question.question_text}</p>
              <p className="text-xs text-slate-500 mb-4">{qr.totalAnswers} answer{qr.totalAnswers === 1 ? "" : "s"}</p>

              {qr.choiceBreakdown && (
                <div className="space-y-2">
                  {qr.choiceBreakdown.map((c) => {
                    const pct = qr.totalAnswers > 0 ? Math.round((c.count / qr.totalAnswers) * 100) : 0;
                    return (
                      <div key={c.option_id}>
                        <div className="flex justify-between text-xs text-slate-300 mb-1">
                          <span>{c.option_text}</span>
                          <span>{c.count} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {qr.averageScale !== undefined && qr.scaleDistribution && (
                <div>
                  <p className="text-sm font-bold text-amber-300 mb-3">Average: {qr.averageScale.toFixed(1)} / {qr.question.scale_max}</p>
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
