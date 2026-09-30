import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import HotspotPlayer from "../../components/quiz/HotspotPlayer";
import ExamCalculator from "../../components/quiz/ExamCalculator";
import {
  getExamState, getExamPaper, saveExamAnswer, submitExam, flagExamTabSwitch, getMyExamResult,
  uploadAnswerPhoto, removeAnswerPhoto, signedOwnPhotoUrl, checkHotspotTap,
} from "../../repositories/exam/examPlayRepository";
import { getPublicQuizBranding } from "../../repositories/quiz/quizSettingsRepository";
import { startLobbyAmbience } from "../../services/quiz/quizSoundService";
import FallingWords, { DEFAULT_MOTIVATIONAL_WORDS } from "../../components/quiz/FallingWords";
import type { ExamState, ExamPaperQuestion, ExamAnswerDraft, MyExamResultRow } from "../../types/exam";
import type { QuizPublicBranding } from "../../types/quiz";

type Phase = "loading" | "lobby" | "paper" | "submitted" | "result" | "error";
type SaveStatus = "saved" | "saving" | "offline";

const EMPTY_DRAFT: ExamAnswerDraft = { selected_option_id: null, click_x: null, click_y: null, hotspot_taps: [], text: "", image_paths: [], flagged: false, selected_is_correct: null };
const LOCKED_RE = /locked|already submitted|time is over|not started/i;

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

function isAnswered(d: ExamAnswerDraft | undefined): boolean {
  if (!d) return false;
  return d.selected_option_id !== null || d.click_x !== null || d.hotspot_taps.length > 0 || d.text.trim() !== "" || d.image_paths.length > 0;
}

/**
 * The exam paper: every question on one scrolling screen, in this
 * employee's own order, answered in any order, against one clock for the
 * whole paper. Built for a phone: answers autosave to the server (and to the
 * device first, so a dropped connection loses nothing), the clock comes from
 * the DATABASE, and nothing about a result is shown until the trainer
 * releases it.
 */
export default function ExamPaperPage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("loading");
  const [state, setState] = useState<ExamState | null>(null);
  const [paper, setPaper] = useState<ExamPaperQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, ExamAnswerDraft>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [lobbySeconds, setLobbySeconds] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MyExamResultRow[] | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [photoError, setPhotoError] = useState<Record<string, string>>({});
  const [branding, setBranding] = useState<QuizPublicBranding | null>(null);
  const [musicOn, setMusicOn] = useState(true);
  const lobbyAudioRef = useRef<HTMLAudioElement | null>(null);
  const lobbyStopRef = useRef<(() => void) | null>(null);

  // Written answers can't lock on the first keystroke (that would cap you at
  // one character) — instead the candidate composes freely, then explicitly
  // locks it. Persisted locally so a mid-exam reload on the same phone keeps
  // it locked; MCQ/hotspot need no such tracking since isAnswered() already
  // tells us "given" the moment a single tap/click sets them.
  const lockedWrittenKey = `exam-locked-written-${sessionId}`;
  const [lockedWritten, setLockedWritten] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(lockedWrittenKey) || "[]")); } catch { return new Set(); }
  });
  function lockWritten(qid: string) {
    setLockedWritten((prev) => {
      const next = new Set(prev).add(qid);
      try { localStorage.setItem(lockedWrittenKey, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  // MCQ/truefalse pick a pending option first — same "tap then confirm"
  // pattern as hotspot, so a locked-in wrong answer never comes from an
  // accidental scroll-tap, and gives an explicit Not Sure escape hatch.
  const [pendingMcq, setPendingMcq] = useState<Record<string, string>>({});

  // Brief "already answered" flash for MCQ/True-False — hotspot has its own
  // version of this built into HotspotPlayer itself.
  const [blockedFlashQid, setBlockedFlashQid] = useState<string | null>(null);
  const blockedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashBlocked(qid: string) {
    setBlockedFlashQid(qid);
    if (blockedFlashTimer.current) clearTimeout(blockedFlashTimer.current);
    blockedFlashTimer.current = setTimeout(() => setBlockedFlashQid(null), 1600);
  }

  const clockOffsetMs = useRef(0);
  const pendingRef = useRef<Record<string, ExamAnswerDraft>>({});
  const flushingRef = useRef(false);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmitted = useRef(false);
  const draftKey = `exam-pending-${sessionId}`;

  const applyState = useCallback((s: ExamState, receivedAt: number) => {
    clockOffsetMs.current = new Date(s.server_now).getTime() - receivedAt;
    setState(s);
  }, []);

  function persistPending() {
    try {
      localStorage.setItem(draftKey, JSON.stringify(pendingRef.current));
    } catch { /* storage full/blocked — the server copy still exists */ }
  }

  // ── Saving: device first, then server; retried until it lands ──────────
  const flush = useCallback(async (): Promise<boolean> => {
    if (flushingRef.current) return false;
    flushingRef.current = true;
    setSaveStatus("saving");
    try {
      while (Object.keys(pendingRef.current).length > 0) {
        const qid = Object.keys(pendingRef.current)[0];
        const draft = pendingRef.current[qid];
        try {
          const isCorrect = await saveExamAnswer(sessionId, qid, draft);
          if (pendingRef.current[qid] === draft) delete pendingRef.current[qid];
          try { localStorage.setItem(draftKey, JSON.stringify(pendingRef.current)); } catch { /* ignore */ }
          // mcq/truefalse only — the server grades on save now, purely for instant reveal.
          setAnswers((prev) => {
            const cur = prev[qid];
            if (!cur || cur.selected_is_correct === isCorrect) return prev;
            return { ...prev, [qid]: { ...cur, selected_is_correct: isCorrect } };
          });
        } catch (e) {
          if (e instanceof Error && LOCKED_RE.test(e.message)) {
            // The exam is over for this device — nothing more can be saved.
            pendingRef.current = {};
            try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
            setSaveStatus("saved");
            return false;
          }
          setSaveStatus("offline");
          return false;
        }
      }
      setSaveStatus("saved");
      return true;
    } finally {
      flushingRef.current = false;
    }
  }, [sessionId, draftKey]);

  async function flushAll(): Promise<boolean> {
    for (let i = 0; i < 40 && flushingRef.current; i++) await new Promise((r) => setTimeout(r, 100));
    return flush();
  }

  // Computes and records the next draft SYNCHRONOUSLY (not inside the
  // setAnswers updater, whose timing React doesn't guarantee) so a caller
  // that immediately triggers a save — e.g. instant reveal, or a hotspot
  // confirm firing right after an async server check — always reads the
  // just-applied patch from pendingRef, never a stale one from before it.
  // Two taps confirmed back-to-back without this raced: the second tap's
  // save could fire before React had processed the first's setAnswers
  // update, so it saved a draft missing that first tap (or overwrote the
  // server with one), even though pendingRef.current[qid] existed the whole
  // time — the bug was reading it via the updater's `prev` instead of here.
  function setDraft(qid: string, patch: Partial<ExamAnswerDraft>): ExamAnswerDraft {
    const next = { ...(pendingRef.current[qid] ?? answers[qid] ?? EMPTY_DRAFT), ...patch };
    pendingRef.current[qid] = next;
    persistPending();
    setAnswers((prev) => ({ ...prev, [qid]: next }));
    setSaveStatus("saving");
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => { void flush(); }, 700);
    return next;
  }

  // ── Load ────────────────────────────────────────────────────────────────
  const loadPaper = useCallback(async () => {
    const questions = await getExamPaper(sessionId);
    const merged: Record<string, ExamAnswerDraft> = {};
    for (const q of questions) merged[q.question_id] = q.saved;

    // Anything this device saved locally but never got to the server is
    // newer than what the server has — put it back and keep retrying.
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const local = JSON.parse(raw) as Record<string, ExamAnswerDraft>;
        for (const [qid, d] of Object.entries(local)) {
          if (merged[qid] !== undefined) { merged[qid] = d; pendingRef.current[qid] = d; }
        }
      }
    } catch { /* ignore a corrupt local copy */ }

    setPaper(questions);
    setAnswers(merged);
    setPhase("paper");
    if (Object.keys(pendingRef.current).length > 0) void flush();
  }, [sessionId, draftKey, flush]);

  const bootstrap = useCallback(async () => {
    try {
      const receivedAtStart = Date.now();
      const s = await getExamState(sessionId);
      applyState(s, (receivedAtStart + Date.now()) / 2);
      if (s.submitted_at) {
        setPhase(s.results_released ? "result" : "submitted");
        return;
      }
      if (s.status === "lobby") { setPhase("lobby"); return; }
      if (s.status === "finished") {
        // Time ran out (or the trainer ended it) before this device submitted.
        await flushAll();
        await submitExam(sessionId, "timeout").catch(() => {});
        setPhase("submitted");
        return;
      }
      await loadPaper();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load the exam.";
      if (/not joined/i.test(msg)) { navigate(ROUTES.EXAM_JOIN, { replace: true }); return; }
      setError(msg);
      setPhase("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, applyState, loadPaper, navigate]);

  useEffect(() => { void bootstrap(); }, [bootstrap]);

  useEffect(() => { getPublicQuizBranding().then(setBranding).catch(() => {}); }, []);

  // Lobby wait music — admin-configurable (builtin/custom/off), starts once the
  // lobby screen is showing and settings have loaded, stops the moment the
  // paper opens or the candidate mutes it. Never plays outside the lobby.
  useEffect(() => {
    function stopAll() {
      lobbyStopRef.current?.();
      lobbyStopRef.current = null;
      lobbyAudioRef.current?.pause();
      lobbyAudioRef.current = null;
    }
    if (phase !== "lobby" || !branding || !musicOn) return stopAll;
    const choice = branding.exam_lobby_music;
    if (choice === "builtin") {
      lobbyStopRef.current = startLobbyAmbience(branding.exam_lobby_music_volume);
    } else if (choice === "custom" && branding.exam_lobby_music_url) {
      const audio = new Audio(branding.exam_lobby_music_url);
      audio.loop = true;
      audio.volume = Math.min(1, Math.max(0, branding.exam_lobby_music_volume / 100));
      audio.play().catch(() => {});
      lobbyAudioRef.current = audio;
    }
    return stopAll;
  }, [phase, branding, musicOn]);

  // ── Clocks (database time, corrected for this device) ───────────────────
  useEffect(() => {
    if (!state || (phase !== "lobby" && phase !== "paper")) return;
    const opensAt = new Date(state.opens_at).getTime();
    const deadline = new Date(state.deadline_at).getTime();

    async function tick() {
      const now = Date.now() + clockOffsetMs.current;
      if (phase === "lobby") {
        const left = Math.max(0, Math.ceil((opensAt - now) / 1000));
        setLobbySeconds(left);
        if (left === 0) void bootstrap();
        return;
      }
      const left = Math.max(0, Math.ceil((deadline - now) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        await doSubmit("timeout");
      }
    }
    void tick();
    const t = setInterval(() => { void tick(); }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.opens_at, state?.deadline_at, phase]);

  // Pick up an extension / early end from the trainer, and retry saves.
  useEffect(() => {
    if (phase !== "paper" && phase !== "submitted" && phase !== "lobby") return;
    const t = setInterval(async () => {
      try {
        const before = Date.now();
        const s = await getExamState(sessionId);
        applyState(s, (before + Date.now()) / 2);
        if (phase === "submitted" && s.results_released) {
          setResult(await getMyExamResult(sessionId));
          setPhase("result");
        }
        if (phase === "paper" && s.status === "finished" && !autoSubmitted.current) {
          autoSubmitted.current = true;
          await doSubmit("timeout");
        }
      } catch { /* transient — the next tick retries */ }
      if (Object.keys(pendingRef.current).length > 0) void flush();
    }, phase === "paper" ? 15000 : 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sessionId]);

  useEffect(() => {
    if (phase === "result" && !result) getMyExamResult(sessionId).then(setResult).catch(() => {});
  }, [phase, result, sessionId]);

  // Flush the moment the connection or the tab comes back.
  useEffect(() => {
    function onBack() { if (document.visibilityState === "visible" && Object.keys(pendingRef.current).length > 0) void flush(); }
    window.addEventListener("online", onBack);
    document.addEventListener("visibilitychange", onBack);
    return () => { window.removeEventListener("online", onBack); document.removeEventListener("visibilitychange", onBack); };
  }, [flush]);

  // Integrity: note when the employee leaves the tab mid-exam; warn before closing it.
  useEffect(() => {
    if (phase !== "paper") return;
    function onHide() { if (document.visibilityState === "hidden") void flagExamTabSwitch(sessionId); }
    function onUnload(e: BeforeUnloadEvent) { e.preventDefault(); e.returnValue = ""; }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("beforeunload", onUnload); };
  }, [phase, sessionId]);

  // Thumbnails for attached photos (private bucket -> signed links).
  useEffect(() => {
    const wanted = Object.values(answers).flatMap((d) => d.image_paths).filter((p) => !photoUrls[p]);
    if (wanted.length === 0) return;
    let cancelled = false;
    Promise.all(wanted.map(async (p) => [p, await signedOwnPhotoUrl(p)] as const)).then((pairs) => {
      if (cancelled) return;
      setPhotoUrls((prev) => {
        const next = { ...prev };
        for (const [p, url] of pairs) if (url) next[p] = url;
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [answers, photoUrls]);

  // ── Submit ──────────────────────────────────────────────────────────────
  async function doSubmit(reason: "manual" | "timeout") {
    setSubmitting(true);
    setError("");
    try {
      const saved = await flushAll();
      if (!saved && reason === "manual" && Object.keys(pendingRef.current).length > 0) {
        setError("Some answers could not be saved — check your internet connection and try again.");
        setSubmitting(false);
        autoSubmitted.current = false;
        return;
      }
      await submitExam(sessionId, reason);
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      setShowConfirm(false);
      setPhase("submitted");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit.");
      autoSubmitted.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  // ── Photos ──────────────────────────────────────────────────────────────
  async function handlePhoto(qid: string, files: FileList | null) {
    const file = files?.[0];
    if (!file || !state) return;
    const current = answers[qid] ?? EMPTY_DRAFT;
    if (current.image_paths.length >= 5) { setPhotoError((p) => ({ ...p, [qid]: "You can attach up to 5 photos per answer." })); return; }
    setUploading((u) => ({ ...u, [qid]: true }));
    setPhotoError((p) => ({ ...p, [qid]: "" }));
    try {
      const path = await uploadAnswerPhoto(sessionId, state.participant_id, qid, file);
      const latest = pendingRef.current[qid] ?? answers[qid] ?? EMPTY_DRAFT;
      setDraft(qid, { image_paths: [...latest.image_paths, path] });
    } catch (e) {
      setPhotoError((p) => ({ ...p, [qid]: e instanceof Error ? e.message : "Upload failed — check your connection and try again." }));
    } finally {
      setUploading((u) => ({ ...u, [qid]: false }));
    }
  }

  function handleRemovePhoto(qid: string, path: string) {
    const latest = pendingRef.current[qid] ?? answers[qid] ?? EMPTY_DRAFT;
    setDraft(qid, { image_paths: latest.image_paths.filter((p) => p !== path) });
    void removeAnswerPhoto(path);
  }

  const answeredCount = useMemo(() => paper.filter((q) => isAnswered(answers[q.question_id])).length, [paper, answers]);
  const flaggedCount = useMemo(() => paper.filter((q) => answers[q.question_id]?.flagged).length, [paper, answers]);

  function jumpTo(qid: string) {
    setShowPalette(false);
    document.getElementById(`q-${qid}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Screens ─────────────────────────────────────────────────────────────
  const shell = "min-h-screen bg-slate-950 text-white";

  if (phase === "loading") return <div className={`${shell} flex items-center justify-center text-slate-500`}>Loading…</div>;

  if (phase === "error") {
    return (
      <div className={`${shell} flex items-center justify-center px-4`}>
        <div className="max-w-sm text-center bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <p className="text-sm text-red-300 mb-4">{error}</p>
          <button onClick={() => navigate(ROUTES.EXAM_JOIN)} className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 rounded-lg px-4 py-2.5">Back</button>
        </div>
      </div>
    );
  }

  if (phase === "lobby" && state) {
    const lobbyWords = branding?.login_words_enabled === false ? null : (
      branding?.login_motivational_words
        ? branding.login_motivational_words.split(/\r?\n|,/).map((w) => w.trim()).filter(Boolean)
        : DEFAULT_MOTIVATIONAL_WORDS
    );
    return (
      <div className={`${shell} relative flex items-center justify-center px-4 overflow-hidden`}>
        {lobbyWords && lobbyWords.length > 0 && <FallingWords words={lobbyWords} />}
        <div className="relative max-w-sm w-full text-center bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400 mx-auto mb-3 animate-pulse" />
          <h1 className="text-lg font-bold mb-1">{state.quiz_title}</h1>
          <p className="text-xs text-slate-400 mb-1">You're in, {state.display_name}. The exam starts soon — stay on this screen.</p>
          <p className="text-xs text-slate-500 mb-5">{state.total_questions} questions · {Math.round(state.duration_seconds / 60)} min</p>
          <p className="text-4xl font-mono font-black text-amber-400">{formatClock(lobbySeconds)}</p>
          <p className="text-[11px] text-slate-500 mt-2">until it starts</p>
          {branding && branding.exam_lobby_music !== "off" && (
            <button
              onClick={() => setMusicOn((v) => !v)}
              className="mt-5 text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 mx-auto"
            >
              {musicOn ? "🔊 Music on — tap to mute" : "🔇 Music off — tap to unmute"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (phase === "submitted" && state) {
    return (
      <div className={`${shell} flex items-center justify-center px-4`}>
        <div className="max-w-sm w-full text-center bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <div className="text-5xl mb-3">✅</div>
          <h1 className="text-lg font-bold mb-1">Submitted, {state.display_name}!</h1>
          <p className="text-sm text-slate-400">Your answers are in. Your trainer will share the result once everyone has finished — you can close this screen.</p>
        </div>
      </div>
    );
  }

  if (phase === "result" && state) {
    const rows = result ?? [];
    const total = rows.reduce((s, r) => s + (r.marks_awarded ?? 0), 0);
    const possible = rows.reduce((s, r) => s + r.marks, 0);
    const pct = possible > 0 ? Math.round((total / possible) * 1000) / 10 : 0;
    const passed = pct >= state.passing_score_pct;
    return (
      <div className={`${shell} px-4 py-8`}>
        <div className="max-w-lg mx-auto space-y-4">
          <div className="text-center bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">{state.quiz_title}</p>
            <p className="text-5xl font-black text-amber-400">{pct}%</p>
            <p className="text-sm text-slate-300 mt-1">{total} / {possible} marks</p>
            <p className={`inline-block mt-3 text-sm font-bold rounded-full px-4 py-1 ${passed ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
              {passed ? "✓ Passed" : "Not passed"} (pass mark {state.passing_score_pct}%)
            </p>
          </div>
          {rows.map((r) => (
            <div key={r.question_order} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left">
              <p className="text-sm font-semibold mb-2">Q{r.question_order + 1}. {r.question_text}</p>
              <p className="text-xs text-slate-400">Your answer: <span className="text-slate-200">{r.my_selected_option_text ?? r.my_answer_text ?? (r.answered ? "(map tap / photo)" : "— not answered")}</span></p>
              {r.correct_option_text && <p className="text-xs text-emerald-300 mt-1">Correct: {r.correct_option_text}</p>}
              <p className="text-xs mt-1 text-amber-300">{r.marks_awarded ?? 0} / {r.marks} marks</p>
              {r.grader_comment && <p className="text-xs mt-1 text-slate-300 bg-slate-800 rounded-lg px-3 py-2">💬 {r.grader_comment}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!state) return null;

  // ── The paper ───────────────────────────────────────────────────────────
  const urgent = secondsLeft <= 300;
  const unanswered = paper.length - answeredCount;

  return (
    <div className={`${shell} pb-28`}>
      <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">{state.quiz_title}</p>
          <p className="text-[11px] text-slate-500">
            {saveStatus === "saved" && "✓ All answers saved"}
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "offline" && <span className="text-amber-300">⚠ Offline — answers are safe on this phone and will save when you're back online</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowCalc((s) => !s)}
            className={`rounded-full h-9 w-9 flex items-center justify-center text-base border ${showCalc ? "bg-violet-600 border-violet-500 text-white" : "bg-slate-800 border-slate-700 text-slate-300"}`}
            aria-label="Toggle calculator"
            title="Calculator"
          >
            🧮
          </button>
          <span className={`rounded-full px-3 py-1.5 font-mono text-sm font-bold ${urgent ? "bg-red-500/20 text-red-300 animate-pulse" : "bg-slate-800 text-slate-100"}`}>
            ⏱ {formatClock(secondsLeft)}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-4 space-y-4">
        {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
        {state.description && <p className="text-sm text-slate-400">{state.description}</p>}

        {paper.map((q) => {
          const d = answers[q.question_id] ?? EMPTY_DRAFT;
          return (
            <div key={q.question_id} id={`q-${q.question_id}`} className={`scroll-mt-20 bg-slate-900 border rounded-2xl p-4 ${d.flagged ? "border-amber-500/60" : "border-slate-800"}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono rounded px-2 py-0.5 ${isAnswered(d) ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>Q{q.position}</span>
                  <span className="text-[11px] text-slate-500">{q.marks} mark{q.marks === 1 ? "" : "s"}</span>
                </div>
                <button
                  onClick={() => setDraft(q.question_id, { flagged: !d.flagged })}
                  className={`text-xs rounded-lg px-2.5 py-1.5 border ${d.flagged ? "border-amber-500 text-amber-300 bg-amber-500/10" : "border-slate-700 text-slate-400"}`}
                >
                  🚩 {d.flagged ? "Marked" : "Review later"}
                </button>
              </div>

              <p className="text-base font-semibold leading-snug mb-3 whitespace-pre-wrap">{q.question_text}</p>

              {(q.type === "mcq" || q.type === "truefalse") && (() => {
                const locked = isAnswered(d);
                const revealOn = branding?.exam_reveal_answers ?? true;
                const pendingOptionId = pendingMcq[q.question_id];
                return (
                  <div className="space-y-2">
                    {q.options.map((o) => {
                      const sel = d.selected_option_id === o.option_id;
                      const pending = pendingOptionId === o.option_id;
                      const reveal = revealOn && sel && d.selected_is_correct !== null;
                      const selClass = pending
                        ? "border-amber-400 bg-amber-400/15 text-white font-semibold"
                        : !sel
                          ? "border-slate-700 text-slate-200 hover:border-slate-500"
                          : reveal
                            ? d.selected_is_correct
                              ? "border-emerald-500 bg-emerald-500/20 text-white font-semibold"
                              : "border-red-500 bg-red-500/20 text-white font-semibold"
                            : "border-violet-500 bg-violet-500/20 text-white font-semibold";
                      return (
                        <button
                          key={o.option_id}
                          onClick={() => {
                            if (locked) { flashBlocked(q.question_id); return; }
                            // First tap on any option just proposes it — Confirm actually locks it in.
                            setPendingMcq((prev) => ({ ...prev, [q.question_id]: o.option_id }));
                          }}
                          className={`w-full text-left rounded-xl px-4 py-3 min-h-[48px] text-[15px] border-2 transition-colors ${selClass} ${locked && !sel ? "opacity-40" : ""}`}
                        >
                          {pending ? "📍 " : sel ? (reveal ? (d.selected_is_correct ? "✓ " : "✗ ") : "● ") : "○ "}{o.option_text}
                        </button>
                      );
                    })}
                    {!locked && pendingOptionId && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs font-semibold text-amber-200 flex-1">Sure about this one?</span>
                        <button
                          onClick={() => setPendingMcq((prev) => { const next = { ...prev }; delete next[q.question_id]; return next; })}
                          className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full px-3 py-1.5"
                        >
                          🤔 Not sure
                        </button>
                        <button
                          onClick={() => {
                            setDraft(q.question_id, { selected_option_id: pendingOptionId });
                            setPendingMcq((prev) => { const next = { ...prev }; delete next[q.question_id]; return next; });
                            // Skip the usual 700ms autosave debounce — an instant reveal needs the save (and its is_correct) right away.
                            if (flushTimer.current) clearTimeout(flushTimer.current);
                            void flush();
                          }}
                          className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-full px-3 py-1.5"
                        >
                          ✅ Confirm
                        </button>
                      </div>
                    )}
                    {blockedFlashQid === q.question_id ? (
                      <p className="text-[11px] font-semibold text-amber-300">🔒 Already answered — no changes allowed.</p>
                    ) : locked ? (
                      <p className="text-[11px] text-slate-500">🔒 Answer locked — this can't be changed.</p>
                    ) : null}
                  </div>
                );
              })()}

              {q.type === "hotspot" && q.image_url && (() => {
                const maxTaps = q.hotspotZoneCount ?? 1;
                return (
                  <div className="-mx-4">
                    <HotspotPlayer
                      imageUrl={q.image_url}
                      disabled={false}
                      requireConfirm
                      maxTaps={maxTaps}
                      confirmedTaps={d.hotspot_taps}
                      feedbackSeconds={branding?.exam_hotspot_feedback_seconds ?? 3}
                      feedbackSize={branding?.exam_hotspot_feedback_size ?? "small"}
                      onTap={() => {}}
                      onConfirmTap={async (x, y) => {
                        // Reads the freshest known array (pendingRef, kept in sync by setDraft
                        // synchronously) rather than the `d` closure, which an async gap like the
                        // network check below could otherwise leave one tap behind.
                        const latestTaps = (pendingRef.current[q.question_id] ?? d).hotspot_taps;
                        if (latestTaps.length >= maxTaps) return;
                        const revealOn = branding?.exam_reveal_answers ?? true;
                        let tap = { x, y } as ExamAnswerDraft["hotspot_taps"][number];
                        if (revealOn) {
                          try {
                            const result = await checkHotspotTap(sessionId, q.question_id, x, y);
                            tap = { x, y, correct: result.correct, label: result.label };
                          } catch { /* offline/error — still record the tap, submit-time grading is authoritative anyway */ }
                        }
                        const base = (pendingRef.current[q.question_id] ?? d).hotspot_taps;
                        setDraft(q.question_id, { hotspot_taps: [...base, tap] });
                        if (flushTimer.current) clearTimeout(flushTimer.current);
                        void flush();
                      }}
                    />
                  </div>
                );
              })()}

              {q.type === "written" && (() => {
                const locked = lockedWritten.has(q.question_id);
                return (
                  <div className="space-y-3">
                    <textarea
                      value={d.text}
                      onChange={(e) => setDraft(q.question_id, { text: e.target.value })}
                      disabled={locked}
                      rows={5}
                      placeholder="Type your answer here…"
                      className={`w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-3 text-[15px] text-white outline-none focus:border-violet-500 ${locked ? "opacity-60" : ""}`}
                    />
                    {!locked && (
                      <div className="flex flex-wrap gap-2">
                        <label className="text-xs font-semibold bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-2.5 cursor-pointer">
                          📷 Take photo
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void handlePhoto(q.question_id, e.target.files); e.target.value = ""; }} />
                        </label>
                        <label className="text-xs font-semibold bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-2.5 cursor-pointer">
                          🖼 Choose photo
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { void handlePhoto(q.question_id, e.target.files); e.target.value = ""; }} />
                        </label>
                        {uploading[q.question_id] && <span className="text-xs text-slate-400 self-center">Uploading…</span>}
                      </div>
                    )}
                    {photoError[q.question_id] && <p className="text-xs text-red-300">{photoError[q.question_id]}</p>}
                    {d.image_paths.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {d.image_paths.map((p) => (
                          <div key={p} className="relative h-24 w-24 rounded-lg overflow-hidden border border-slate-700 bg-slate-800">
                            {photoUrls[p] ? <img src={photoUrls[p]} alt="Attached answer" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-500">…</div>}
                            {!locked && <button onClick={() => handleRemovePhoto(q.question_id, p)} className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/70 text-white text-xs" aria-label="Remove photo">✕</button>}
                          </div>
                        ))}
                      </div>
                    )}
                    {!locked && isAnswered(d) && (
                      <button onClick={() => lockWritten(q.question_id)} className="text-xs font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-200 rounded-lg px-3 py-2">
                        🔒 Lock this answer
                      </button>
                    )}
                    {locked && <p className="text-[11px] text-slate-500">🔒 Answer locked — this can't be changed.</p>}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Bottom bar: progress, question palette, submit */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-slate-950/95 backdrop-blur border-t border-slate-800 px-3 py-2.5" style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <button onClick={() => setShowPalette(true)} className="flex-1 text-left rounded-xl border border-slate-700 px-3 py-2">
            <span className="block text-[11px] text-slate-500">Questions</span>
            <span className="text-sm font-semibold">{answeredCount}/{paper.length} answered{flaggedCount > 0 && <span className="text-amber-300"> · 🚩{flaggedCount}</span>}</span>
          </button>
          <button onClick={() => setShowConfirm(true)} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-3 text-sm">Submit</button>
        </div>
      </div>

      <ExamCalculator open={showCalc} onClose={() => setShowCalc(false)} />

      {showPalette && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setShowPalette(false)}>
          <div className="w-full sm:max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold">Jump to a question</p>
              <button onClick={() => setShowPalette(false)} className="text-slate-400 text-sm">Close</button>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {paper.map((q) => {
                const d = answers[q.question_id];
                const cls = d?.flagged ? "bg-amber-500/20 border-amber-500 text-amber-200" : isAnswered(d) ? "bg-emerald-500/20 border-emerald-500 text-emerald-200" : "bg-slate-800 border-slate-700 text-slate-300";
                return <button key={q.question_id} onClick={() => jumpTo(q.question_id)} className={`h-11 rounded-lg border text-sm font-semibold ${cls}`}>{q.position}</button>;
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-3">Green = answered · Amber = marked for review · Grey = not answered</p>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-bold mb-2">Submit your exam?</h2>
            <p className="text-sm text-slate-300 mb-1">{answeredCount} of {paper.length} answered.</p>
            {unanswered > 0 && <p className="text-sm text-amber-300 mb-1">{unanswered} question{unanswered === 1 ? " is" : "s are"} still blank.</p>}
            {flaggedCount > 0 && <p className="text-sm text-amber-300 mb-1">{flaggedCount} marked for review.</p>}
            <p className="text-xs text-slate-500 mt-2 mb-4">Each answer locks the moment you give it, so there's nothing left to change here — and you won't see a result until your trainer shares it.</p>
            {error && <p className="text-xs text-red-300 mb-3">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowConfirm(false); setError(""); }} disabled={submitting} className="flex-1 text-sm font-semibold border border-slate-700 rounded-lg px-4 py-3">Keep working</button>
              <button onClick={() => void doSubmit("manual")} disabled={submitting} className="flex-1 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg px-4 py-3">
                {submitting ? "Submitting…" : "Submit now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
