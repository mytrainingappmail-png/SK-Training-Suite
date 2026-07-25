// "Brainstorming" — a colourful, game-show-style multiple-choice quiz for
// employee engagement. Deliberately unscored (nothing is saved/reported)
// so it stays a fun break, not another test. Timer, lock-in, and lifelines
// are inspired by the format of shows like "who wants to be a millionaire"
// style quizzes generally — no branding, names, or actual show music are
// used; all sound effects are generated in-browser (see utils/quizSounds).

import { useEffect, useRef, useState } from 'react';
import { loadItems } from '../../services/brainstorming/brainstormingService';
import { loadBrainstormingSettings } from '../../services/brainstormingSettings/brainstormingSettingsService';
import { playCorrectSound, playWrongSound, playTickSound, playLockInSound, playLifelineSound } from '../../utils/quizSounds';
import { startTensionMusic, stopTensionMusic, speakCorrect, speakWrong, stopSpeaking } from '../../utils/quizVoice';
import type { BrainstormingItem, OptionLetter } from '../../types/brainstorming';
import type { BrainstormingSettings } from '../../types/brainstormingSettings';

const QUESTION_SECONDS = 30;
// A round is a short, focused burst — not a march through the entire
// question bank. Pick a small random batch each time instead.
const ROUND_SIZE = 10;

function funnyComment(pct: number): { emoji: string; text: string } {
  if (pct === 100) return { emoji: '🏆', text: 'PERFECT SCORE! Are you secretly Google?' };
  if (pct >= 80) return { emoji: '🔥', text: "On fire! Your brain deserves a raise." };
  if (pct >= 60) return { emoji: '😎', text: 'Solid! Not bad for a human.' };
  if (pct >= 40) return { emoji: '🤔', text: 'Middle of the pack — coffee break?' };
  if (pct >= 20) return { emoji: '😅', text: 'Yikes. Google exists for a reason.' };
  return { emoji: '🙈', text: 'Well... at least you showed up!' };
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function difficultyCls(d: string): string {
  if (d === 'Easy') return 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40';
  if (d === 'Hard') return 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/40';
  return 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40';
}

function Skeleton() {
  return <div className="h-96 animate-pulse rounded-3xl bg-white/10" />;
}

function Brainstorming() {
  const [allItems, setAllItems] = useState<BrainstormingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const [queue, setQueue] = useState<BrainstormingItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<OptionLetter | null>(null);
  const [locked, setLocked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [hiddenOptions, setHiddenOptions] = useState<Set<OptionLetter>>(new Set());
  const [audiencePoll, setAudiencePoll] = useState<Record<OptionLetter, number> | null>(null);
  const [usedFiftyFifty, setUsedFiftyFifty] = useState(false);
  const [usedAudience, setUsedAudience] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<BrainstormingSettings | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLoading(true);
    loadItems()
      .then((rows) => setAllItems(rows.filter((r) => r.active)))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
    loadBrainstormingSettings().then(setVoiceSettings).catch(() => setVoiceSettings(null));
  }, []);

  // Stop any in-flight music/speech if the employee navigates away mid-round.
  useEffect(() => {
    return () => {
      stopTensionMusic();
      stopSpeaking();
    };
  }, []);

  // Pressing the browser Back button while a round is in progress (or the
  // summary popup is open) should just exit back to the start screen on
  // this same page — not leave Brainstorming for whatever section was
  // visited before it. Pushing a history entry when the round starts
  // means Back consumes that entry first (via popstate) instead of
  // navigating away; a second Back press then behaves normally.
  useEffect(() => {
    if (!started) return;
    window.history.pushState({ brainstorming: true }, '');
    function onPopState() {
      setStarted(false);
      setShowSummary(false);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [started]);

  function beginRound() {
    setQueue(shuffle(allItems).slice(0, ROUND_SIZE));
    setIndex(0);
    setStreak(0);
    setCorrectCount(0);
    setAnsweredCount(0);
    setShowSummary(false);
    setUsedFiftyFifty(false);
    setUsedAudience(false);
    resetQuestionState();
    setStarted(true);
  }

  function resetQuestionState() {
    setSelected(null);
    setLocked(false);
    setRevealed(false);
    setHiddenOptions(new Set());
    setAudiencePoll(null);
    setTimeLeft(QUESTION_SECONDS);
  }

  const current = queue[index] ?? null;

  // Background tension music plays for as long as a question is live
  // (not locked/revealed yet) and stops the moment it's answered.
  useEffect(() => {
    const shouldPlay = started && !!current && !locked && !revealed && (voiceSettings?.music_enabled ?? false);
    if (shouldPlay) startTensionMusic();
    else stopTensionMusic();
    return () => stopTensionMusic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, current?.id, locked, revealed, voiceSettings?.music_enabled]);

  // Countdown timer — stops once an answer is locked in or revealed.
  useEffect(() => {
    if (!started || !current || locked || revealed) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        if (t <= 6) playTickSound();
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, current?.id, locked, revealed]);

  function announce(correct: boolean) {
    if (!voiceSettings?.voice_enabled) return;
    const opts = { style: voiceSettings.voice_style, voiceURI: voiceSettings.voice_uri || undefined };
    if (correct) speakCorrect(opts);
    else speakWrong(opts);
  }

  function handleTimeout() {
    if (!current) return;
    setLocked(true);
    setRevealed(true);
    playWrongSound();
    announce(false);
    setStreak(0);
    setAnsweredCount((n) => n + 1);
  }

  function handleSelect(letter: OptionLetter) {
    if (locked || revealed || !current) return;
    setSelected(letter);
    playLockInSound();
    setLocked(true);
    window.setTimeout(() => {
      setRevealed(true);
      setAnsweredCount((n) => n + 1);
      if (letter === current.correct_option) {
        playCorrectSound();
        announce(true);
        setCorrectCount((c) => c + 1);
        setStreak((s) => {
          const next = s + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });
      } else {
        playWrongSound();
        announce(false);
        setStreak(0);
      }
    }, 700);
  }

  function handleNext() {
    if (index + 1 >= queue.length) {
      setShowSummary(true);
      return;
    }
    setIndex((i) => i + 1);
    resetQuestionState();
  }

  function closeSummary() {
    setShowSummary(false);
    setStarted(false);
  }

  function useFiftyFifty() {
    if (usedFiftyFifty || !current || locked) return;
    playLifelineSound();
    const wrongLetters = (['a', 'b', 'c', 'd'] as OptionLetter[]).filter((l) => l !== current.correct_option);
    const toHide = shuffle(wrongLetters).slice(0, 2);
    setHiddenOptions(new Set(toHide));
    setUsedFiftyFifty(true);
  }

  function useAudiencePoll() {
    if (usedAudience || !current || locked) return;
    playLifelineSound();
    const correctPct = 45 + Math.floor(Math.random() * 30); // 45-74%
    const remaining = 100 - correctPct;
    const others = (['a', 'b', 'c', 'd'] as OptionLetter[]).filter((l) => l !== current.correct_option && !hiddenOptions.has(l));
    const shares = shuffle(others).map(() => Math.random());
    const shareSum = shares.reduce((a, b) => a + b, 0) || 1;
    const poll: Record<OptionLetter, number> = { a: 0, b: 0, c: 0, d: 0 };
    poll[current.correct_option] = correctPct;
    others.forEach((letter, i) => {
      poll[letter] = Math.round((shares[i] / shareSum) * remaining);
    });
    setAudiencePoll(poll);
    setUsedAudience(true);
  }

  const optionLetters: OptionLetter[] = ['a', 'b', 'c', 'd'];
  const optionText: Record<OptionLetter, string> = current
    ? { a: current.option_a, b: current.option_b, c: current.option_c, d: current.option_d }
    : { a: '', b: '', c: '', d: '' };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        <Skeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="overflow-hidden rounded-3xl p-6 text-white shadow-xl sm:p-8"
        style={{ background: 'linear-gradient(135deg, #0F0A2E 0%, #2A1259 45%, #4C1D95 100%)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">Take a break</p>
            <h2 className="mt-1 bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-3xl font-extrabold text-transparent">
              Brainstorming Challenge
            </h2>
            <p className="mt-1 text-sm text-violet-200">Beat the clock, use your lifelines, and see how far your streak goes — just for fun, nothing is scored or recorded.</p>
          </div>
          {started && (
            <div className="flex gap-3">
              <div className="rounded-2xl bg-white/10 px-4 py-2 text-center ring-1 ring-white/20">
                <p className="text-[10px] uppercase tracking-wide text-violet-200">Streak</p>
                <p className="text-xl font-bold text-amber-300">{streak}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-2 text-center ring-1 ring-white/20">
                <p className="text-[10px] uppercase tracking-wide text-violet-200">Best</p>
                <p className="text-xl font-bold text-white">{bestStreak}</p>
              </div>
            </div>
          )}
        </div>

        {error && <div className="mt-5 rounded-xl bg-red-500/20 p-4 text-sm text-red-200 ring-1 ring-red-400/40">{error}</div>}

        {!started && !error && (
          <div className="mt-8">
            <button
              onClick={beginRound}
              className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 px-6 py-4 text-lg font-extrabold text-slate-900 shadow-lg shadow-amber-500/30 transition hover:scale-[1.01] hover:shadow-xl active:scale-[0.99]"
            >
              ▶ Start Challenge
            </button>
          </div>
        )}

        {started && current && (
          <div className="mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-violet-100 ring-1 ring-white/20">
                  Question {index + 1} / {queue.length}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${difficultyCls(current.difficulty)}`}>
                  {current.difficulty}
                </span>
              </div>

              <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-extrabold ring-4 transition-colors ${
                timeLeft <= 6 && !revealed ? 'bg-rose-500/30 text-rose-300 ring-rose-400/60' : 'bg-white/10 text-amber-300 ring-white/20'
              }`}>
                {timeLeft}
              </div>
            </div>

            <div className="mb-5 flex gap-2">
              <button
                onClick={useFiftyFifty}
                disabled={usedFiftyFifty || locked}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  usedFiftyFifty ? 'cursor-not-allowed bg-white/5 text-violet-400' : 'bg-white/10 text-amber-300 ring-1 ring-amber-400/40 hover:bg-white/20'
                }`}
              >
                50-50
              </button>
              <button
                onClick={useAudiencePoll}
                disabled={usedAudience || locked}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  usedAudience ? 'cursor-not-allowed bg-white/5 text-violet-400' : 'bg-white/10 text-amber-300 ring-1 ring-amber-400/40 hover:bg-white/20'
                }`}
              >
                📊 Audience Poll
              </button>
            </div>

            <div className="mb-6 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <p className="text-lg font-semibold leading-relaxed text-white">{current.question}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {optionLetters.map((letter) => {
                if (hiddenOptions.has(letter)) {
                  return <div key={letter} className="rounded-xl border-2 border-dashed border-white/10 p-4 opacity-30" />;
                }
                const isCorrect = letter === current.correct_option;
                const isSelected = selected === letter;
                let cls = 'border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-amber-400/60';
                if (revealed && isCorrect) cls = 'border-emerald-400 bg-emerald-500/30 text-white';
                else if (revealed && isSelected && !isCorrect) cls = 'border-rose-400 bg-rose-500/30 text-white';
                else if (locked && !revealed && isSelected) cls = 'border-amber-400 bg-amber-500/20 text-white';
                else if (locked) cls = 'border-white/10 bg-white/5 text-white/40';

                return (
                  <button
                    key={letter}
                    onClick={() => handleSelect(letter)}
                    disabled={locked}
                    className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left text-sm font-medium transition ${cls}`}
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-black/20 text-xs font-bold uppercase">
                      {letter}
                    </span>
                    <span className="flex-1">{optionText[letter]}</span>
                    {audiencePoll && !hiddenOptions.has(letter) && (
                      <span className="flex-shrink-0 text-xs font-bold text-amber-300">{audiencePoll[letter]}%</span>
                    )}
                  </button>
                );
              })}
            </div>

            {revealed && (
              <div className="mt-5 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
                <p className={`mb-1 text-sm font-bold ${selected === current.correct_option ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {selected === current.correct_option ? '✓ Correct!' : selected ? '✗ Not quite!' : '⏱ Time\'s up!'}
                </p>
                <p className="text-sm leading-relaxed text-violet-100">{current.answer}</p>
                <button
                  onClick={handleNext}
                  className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-3 text-sm font-bold text-slate-900 shadow-md transition hover:scale-[1.01] active:scale-[0.99]"
                >
                  {index + 1 >= queue.length ? 'Finish 🎉' : 'Next Question →'}
                </button>
              </div>
            )}
          </div>
        )}

        {started && !current && !showSummary && (
          <div className="mt-8 rounded-2xl bg-white/10 p-8 text-center ring-1 ring-white/20">
            <p className="text-lg font-semibold text-violet-100">No questions available.</p>
            <button
              onClick={closeSummary}
              className="mt-5 rounded-xl bg-white/10 px-6 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20"
            >
              Back
            </button>
          </div>
        )}
      </div>

      {showSummary && (
        <SummaryPopup
          correctCount={correctCount}
          totalCount={answeredCount}
          bestStreak={bestStreak}
          onClose={closeSummary}
          onPlayAgain={beginRound}
        />
      )}
    </div>
  );
}

function SummaryPopup({ correctCount, totalCount, bestStreak, onClose, onPlayAgain }: {
  correctCount: number; totalCount: number; bestStreak: number; onClose: () => void; onPlayAgain: () => void;
}) {
  const pct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const { emoji, text } = funnyComment(pct);
  const confetti = ['🎉', '✨', '🎊', '⭐', '🎈'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <style>{`
        @keyframes summary-pop-in { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes summary-bounce-emoji { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-14px) rotate(-8deg); } }
        @keyframes summary-confetti-fall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(220px) rotate(360deg); opacity: 0; } }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl p-6 text-center text-white shadow-2xl sm:p-8"
        style={{ background: 'linear-gradient(135deg, #0F0A2E 0%, #2A1259 45%, #4C1D95 100%)', animation: 'summary-pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        {confetti.map((c, i) => (
          <span
            key={i}
            className="pointer-events-none absolute top-0 text-xl"
            style={{
              left: `${10 + i * 18}%`,
              animation: `summary-confetti-fall ${1.6 + i * 0.3}s ease-in ${i * 0.15}s infinite`,
            }}
          >
            {c}
          </span>
        ))}

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20"
        >
          ✕
        </button>

        <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">Round Complete</p>

        <div className="mt-3 text-6xl" style={{ animation: 'summary-bounce-emoji 1.4s ease-in-out infinite' }}>
          {emoji}
        </div>

        <p className="mt-3 text-lg font-extrabold text-white">{text}</p>

        <div className="mt-6 flex justify-center gap-3">
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-center ring-1 ring-white/20">
            <p className="text-[10px] uppercase tracking-wide text-violet-200">Score</p>
            <p className="text-xl font-bold text-amber-300">{correctCount} / {totalCount}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-center ring-1 ring-white/20">
            <p className="text-[10px] uppercase tracking-wide text-violet-200">Best Streak</p>
            <p className="text-xl font-bold text-white">{bestStreak}</p>
          </div>
        </div>

        <button
          onClick={onPlayAgain}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-3 text-sm font-bold text-slate-900 shadow-md transition hover:scale-[1.01] active:scale-[0.99]"
        >
          ▶ Play Again
        </button>
      </div>
    </div>
  );
}

export default Brainstorming;
