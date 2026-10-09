// AI Practice — the employee's side. Pick a customer situation, answer it by typing or speaking, get a score on the
// points the trainer set, a better sample answer, and one thing to try next time. Phone first: one column, big buttons.

import { useEffect, useMemo, useRef, useState } from "react";
import SectionHeroBanner from "../components/learning/SectionHeroBanner";
import { getCurrentUser } from "../services/auth/session";
import {
  getPracticeSettings, listScenarios, listMyAttempts, evaluateAnswer,
  DEFAULT_PRACTICE_SETTINGS,
} from "../repositories/practice/practiceRepository";
import type { PracticeScenario, PracticeAttempt, PracticeSettings } from "../repositories/practice/practiceRepository";

// The browser's built-in speech-to-text (free; Chrome/Edge/Android, recent iPhones). Typed loosely because TypeScript's
// DOM types don't include it.
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
function getRecognitionCtor(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const scoreTone = (s: number) => (s >= 75 ? "#059669" : s >= 50 ? "#D97706" : "#DC2626");
const barTone = (s: number) => (s >= 8 ? "bg-emerald-500" : s >= 5 ? "bg-amber-500" : "bg-rose-500");

function ScoreRing({ score, size = 112 }: { score: number; size?: number }) {
  const color = scoreTone(score);
  return (
    <div className="flex items-center justify-center rounded-full" style={{ width: size, height: size, background: `conic-gradient(${color} ${score * 3.6}deg, #E2E8F0 0deg)` }}>
      <div className="flex items-center justify-center rounded-full bg-white" style={{ width: size - 18, height: size - 18 }}>
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

export default function PracticePage() {
  const user = getCurrentUser();
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_PRACTICE_SETTINGS);
  const [scenarios, setScenarios] = useState<PracticeScenario[]>([]);
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [spoken, setSpoken] = useState(false);
  const [lang, setLang] = useState("en-IN");
  const [listening, setListening] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<PracticeAttempt | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [showHistoryId, setShowHistoryId] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const baseTextRef = useRef("");
  const speechSupported = useMemo(() => getRecognitionCtor() !== null, []);

  function load() {
    if (!user?.companyId || !user.id) return;
    Promise.all([getPracticeSettings(user.companyId), listScenarios(user.companyId), listMyAttempts(user.companyId, user.id)])
      .then(([s, sc, at]) => { setSettings(s); setScenarios(sc.filter((x) => x.active)); setAttempts(at); })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load AI Practice."))
      .finally(() => setLoading(false));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => recRef.current?.stop(), []);

  const stats = useMemo(() => {
    const m = new Map<string, { best: number; count: number; last: PracticeAttempt }>();
    for (const a of attempts) {
      const cur = m.get(a.scenario_id);
      if (!cur) m.set(a.scenario_id, { best: a.total_score, count: 1, last: a });
      else { cur.best = Math.max(cur.best, a.total_score); cur.count += 1; }
    }
    return m;
  }, [attempts]);

  const open = scenarios.find((s) => s.id === openId) ?? null;
  const myHere = open ? attempts.filter((a) => a.scenario_id === open.id) : [];
  const triedCount = new Set(attempts.map((a) => a.scenario_id)).size;

  function openScenario(id: string) {
    stopListening();
    setOpenId(id); setAnswer(""); setSpoken(false); setResult(null); setSubmitError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function stopListening() {
    recRef.current?.stop();
    setListening(false);
  }

  function toggleMic() {
    if (listening) { stopListening(); return; }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    baseTextRef.current = answer ? answer.trimEnd() + " " : "";
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setAnswer((baseTextRef.current + text).slice(0, 2500));
      setSpoken(true);
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setSubmitError("Microphone permission is off. Allow the microphone for this site, or just type your answer.");
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); setSubmitError(""); } catch { setListening(false); }
  }

  async function submit() {
    if (!open) return;
    stopListening();
    setChecking(true);
    setSubmitError("");
    try {
      const r = await evaluateAnswer(open.id, answer.trim(), spoken);
      setResult(r.attempt);
      setRemaining(r.remaining_today);
      setAttempts((prev) => [r.attempt, ...prev]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not check your answer.");
    } finally {
      setChecking(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-1 pb-16 sm:p-2">
      <SectionHeroBanner
        eyebrow="Practice makes you sharp"
        title="AI Practice"
        subtitle="Answer real customer situations in your own words — get instant feedback and a better way to say it."
        statLabel="Situations tried"
        statValue={`${triedCount}/${scenarios.length}`}
      />

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {!settings.enabled ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">AI Practice is not switched on for your company yet.</div>
      ) : scenarios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Your trainer has not added any practice situations yet.</div>
      ) : !open ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {scenarios.map((s) => {
            const st = stats.get(s.id);
            return (
              <button key={s.id} onClick={() => openScenario(s.id)} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md active:scale-[0.99]">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-bold text-slate-900">{s.title}</h3>
                  {st ? (
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ backgroundColor: scoreTone(st.best) }}>Best {st.best}</span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">New</span>
                  )}
                </div>
                <p className="mt-2 line-clamp-3 text-sm italic text-slate-600">“{s.customer_says}”</p>
                <p className="mt-3 text-xs font-semibold text-indigo-600">{st ? `${st.count} ${st.count === 1 ? "try" : "tries"} · Practise again →` : "Start practising →"}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => { stopListening(); setOpenId(null); setResult(null); }} className="text-sm font-semibold text-indigo-700 hover:underline">← All situations</button>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{open.title}</p>
            <div className="mt-3 rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-sm text-slate-800">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">👤 Customer says</p>
              “{open.customer_says}”
            </div>
            {open.context && <p className="mt-3 text-xs text-slate-500">ℹ️ {open.context}</p>}
          </div>

          {!result ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Your answer — what would you say to the customer?</p>
              <textarea
                value={answer}
                onChange={(e) => { setAnswer(e.target.value.slice(0, 2500)); }}
                rows={7}
                placeholder="Type here, or press the microphone and speak…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30"
              />
              <div className="flex flex-wrap items-center gap-2">
                {speechSupported && (
                  <>
                    <button
                      type="button"
                      onClick={toggleMic}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${listening ? "animate-pulse bg-rose-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                      🎤 {listening ? "Listening… tap to stop" : "Speak your answer"}
                    </button>
                    <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={listening} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700" aria-label="Speaking language">
                      <option value="en-IN">English / Hinglish</option>
                      <option value="hi-IN">Hindi</option>
                    </select>
                  </>
                )}
                <span className="ml-auto text-xs text-slate-400">{answer.length}/2500</span>
              </div>
              {submitError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{submitError}</p>}
              <button
                onClick={submit}
                disabled={checking || answer.trim().length < 8 || listening}
                className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {checking ? "AI aapka jawab check kar raha hai…" : "Get feedback ✨"}
              </button>
              <p className="text-center text-[11px] text-slate-400">The AI scores you on {open.criteria.length} points. Your answer and score are visible to your trainer.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <ScoreRing score={result.total_score} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Your score</p>
                  <p className="mt-1 text-sm text-slate-700">{result.feedback}</p>
                  {myHere.length > 1 && (() => {
                    const prev = myHere[1].total_score;
                    const d = result.total_score - prev;
                    return <p className="mt-2 text-xs font-semibold" style={{ color: d >= 0 ? "#059669" : "#DC2626" }}>{d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : "Same as"} vs your last try ({prev})</p>;
                  })()}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                {result.scores.map((s) => (
                  <div key={s.name}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-semibold text-slate-800">{s.name}</span>
                      <span className="font-mono text-xs font-bold text-slate-600">{s.score}/10</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${barTone(s.score)}`} style={{ width: `${s.score * 10}%` }} /></div>
                    {s.comment && <p className="mt-1 text-xs text-slate-500">{s.comment}</p>}
                  </div>
                ))}
              </div>

              {result.better_answer && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">💡 A stronger way to say it</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-emerald-950">{result.better_answer}</p>
                </div>
              )}
              {result.next_step && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>Next time:</b> {result.next_step}</div>
              )}

              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setResult(null); setSubmitError(""); }} className="flex-1 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700">↻ Try again</button>
                <button onClick={() => { setOpenId(null); setResult(null); }} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Other situations</button>
              </div>
              {remaining !== null && <p className="text-center text-xs text-slate-400">{remaining} {remaining === 1 ? "try" : "tries"} left today</p>}
            </div>
          )}

          {myHere.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <button onClick={() => setShowHistoryId(showHistoryId === open.id ? null : open.id)} className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900">
                <span>My tries on this situation ({myHere.length})</span><span className="text-slate-400">{showHistoryId === open.id ? "▲" : "▼"}</span>
              </button>
              {showHistoryId === open.id && (
                <div className="mt-3 divide-y divide-slate-100">
                  {myHere.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 py-2.5">
                      <span className="mt-0.5 w-9 shrink-0 text-center text-sm font-bold" style={{ color: scoreTone(a.total_score) }}>{a.total_score}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-slate-400">{new Date(a.created_at).toLocaleString()}{a.spoken ? " · 🎤" : ""}</p>
                        <p className="line-clamp-2 text-xs text-slate-600">{a.answer_text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
