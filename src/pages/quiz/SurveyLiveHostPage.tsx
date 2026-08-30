import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { getSurveyWithQuestions, fetchSessionResults, buildResultsCsv, downloadCsvFile } from "../../repositories/survey/surveyRepository";
import { getSurveySession, listSessionParticipants, endSurveySession } from "../../repositories/survey/surveyLiveRepository";
import type { SurveyWithQuestions, SurveySession, SurveySessionParticipant, SurveyResults } from "../../types/survey";

const POLL_MS = 4000;

export default function SurveyLiveHostPage() {
  const { surveyId, sessionId } = useParams<{ surveyId: string; sessionId: string }>();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<SurveyWithQuestions | null>(null);
  const [session, setSession] = useState<SurveySession | null>(null);
  const [participants, setParticipants] = useState<SurveySessionParticipant[]>([]);
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [copied, setCopied] = useState<"link" | "pin" | "both" | null>(null);

  async function refresh() {
    if (!sessionId) return;
    const [sess, parts] = await Promise.all([getSurveySession(sessionId), listSessionParticipants(sessionId)]);
    setSession(sess);
    setParticipants(parts);
  }

  useEffect(() => {
    if (!surveyId || !sessionId) return;
    getSurveyWithQuestions(surveyId).then(setSurvey);
    refresh().finally(() => setLoading(false));
  }, [surveyId, sessionId]);

  useEffect(() => {
    if (session?.status !== "active") return;
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [session?.status, sessionId]);

  async function loadResults() {
    if (!sessionId || !survey) return;
    const r = await fetchSessionResults(sessionId, survey.questions);
    setResults(r);
  }

  async function handleEnd() {
    if (!sessionId) return;
    setEnding(true);
    try {
      await endSurveySession(sessionId);
      await refresh();
      await loadResults();
    } finally {
      setEnding(false);
    }
  }

  function handleDownload() {
    if (!survey || !results) return;
    downloadCsvFile(`${survey.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-live-session.csv`, buildResultsCsv(survey, results));
  }

  const joinUrl = `${window.location.origin}${ROUTES.SURVEY_LIVE_JOIN}`;
  const submittedCount = participants.filter((p) => p.submitted_at).length;

  function copyText(text: string, which: "link" | "pin" | "both") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  if (loading || !survey || !session) return <div className="text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">{survey.title} — Live Session</h1>
          <p className="text-sm text-slate-400 mt-0.5">{session.status === "active" ? "🔴 Live" : "⚪ Ended"}</p>
        </div>
        <button onClick={() => navigate(ROUTES.QUIZ_ADMIN_SURVEYS)} className="text-sm font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-4 py-2">
          ← Back to Surveys
        </button>
      </div>

      {session.status === "active" ? (
        <div className="bg-gradient-to-br from-violet-900/40 to-slate-900 border border-violet-700/40 rounded-2xl p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-300 mb-2">Share this — not your browser's address bar</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-300 mb-1">Go to</p>
          <p className="text-lg font-semibold text-white mb-2 break-all">{joinUrl}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-300 mb-1">Enter PIN</p>
          <p className="text-5xl font-mono font-black tracking-[0.2em] text-amber-400 mb-4">{session.pin}</p>

          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => copyText(joinUrl, "link")}
              className="text-xs font-semibold text-violet-200 border border-violet-500/40 hover:bg-violet-500/10 rounded-lg px-3 py-1.5"
            >
              {copied === "link" ? "✓ Link Copied" : "📋 Copy Link"}
            </button>
            <button
              onClick={() => copyText(session.pin, "pin")}
              className="text-xs font-semibold text-violet-200 border border-violet-500/40 hover:bg-violet-500/10 rounded-lg px-3 py-1.5"
            >
              {copied === "pin" ? "✓ PIN Copied" : "📋 Copy PIN"}
            </button>
            <button
              onClick={() => copyText(`Join the survey: ${joinUrl}\nPIN: ${session.pin}`, "both")}
              className="text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-lg px-3 py-1.5"
            >
              {copied === "both" ? "✓ Copied" : "📋 Copy Both (WhatsApp-ready)"}
            </button>
          </div>

          <button
            onClick={handleEnd}
            disabled={ending}
            className="mt-6 text-sm font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg px-5 py-2.5"
          >
            {ending ? "Ending…" : "⏹ End Session & View Results"}
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-slate-300">This session ended {session.ended_at && new Date(session.ended_at).toLocaleString()}.</p>
          {results && (
            <button onClick={handleDownload} className="text-sm font-semibold text-slate-200 border border-slate-700 bg-slate-800 hover:bg-slate-700 rounded-lg px-4 py-2">
              ⬇ Download CSV
            </button>
          )}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white">Who's Joined ({participants.length})</h2>
          <span className="text-xs text-slate-400">{submittedCount} submitted</span>
        </div>
        {participants.length === 0 ? (
          <p className="text-xs text-slate-500">Nobody yet — share the PIN above.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <span
                key={p.id}
                className={`text-xs font-semibold rounded-full px-3 py-1.5 ${
                  p.submitted_at ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"
                }`}
              >
                {p.submitted_at ? "✓ " : "… "}{p.display_name}
              </span>
            ))}
          </div>
        )}
      </div>

      {session.status === "active" && !results && (
        <button onClick={loadResults} className="text-sm font-semibold text-violet-300 hover:text-violet-200 border border-dashed border-slate-700 rounded-xl px-4 py-2.5 w-full">
          📊 Peek at results so far (without ending the session)
        </button>
      )}

      {results && (
        <div className="space-y-4">
          {results.overallPositivityScore !== undefined && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Overall Positivity</p>
              <p className="text-3xl font-bold text-emerald-400">{Math.round(results.overallPositivityScore)}%</p>
            </div>
          )}
          {results.questions.map((qr, i) => (
            <div key={qr.question.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-sm font-semibold text-white mb-3">Q{i + 1}. {qr.question.question_text}</p>
              {qr.choiceBreakdown?.map((c) => {
                const pct = qr.totalAnswers > 0 ? Math.round((c.count / qr.totalAnswers) * 100) : 0;
                return (
                  <div key={c.option_id} className="mb-2">
                    <div className="flex justify-between text-xs text-slate-300 mb-1"><span>{c.option_text}</span><span>{c.count} ({pct}%)</span></div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
              {qr.averageScale !== undefined && <p className="text-sm font-bold text-amber-300">Average: {qr.averageScale.toFixed(1)} / {qr.question.scale_max}</p>}
              {qr.textAnswers?.map((t, ti) => <p key={ti} className="text-sm text-slate-200 bg-slate-800/60 rounded-lg px-3 py-2 mt-1">"{t}"</p>)}
            </div>
          ))}
        </div>
      )}

      <Link to={ROUTES.QUIZ_ADMIN_SURVEY_RESULTS.replace(":surveyId", survey.id)} className="block text-center text-xs text-slate-500 hover:text-slate-300">
        View this survey's combined results (all sessions + link responses) →
      </Link>
    </div>
  );
}
