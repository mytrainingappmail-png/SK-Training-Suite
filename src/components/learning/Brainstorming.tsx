// "Brainstorming" — a colourful, game-show-style multiple-choice quiz for
// employee engagement. Deliberately unscored (nothing is saved/reported)
// so it stays a fun break, not another test. Employees first pick a
// category (Riddles, Movie in Emoji, Sales Puzzle, ...) — each one is its
// own mini "challenge" — then play through that category's questions one
// at a time. Timer, lock-in, and lifelines are inspired by the format of
// shows like "who wants to be a millionaire" style quizzes generally —
// no branding, names, or actual show music are used; all sound effects
// are generated in-browser (see utils/quizSounds and utils/quizVoice)
// unless the admin has uploaded their own audio.

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadItems } from '../../services/brainstorming/brainstormingService';
import { loadBrainstormingSettings } from '../../services/brainstormingSettings/brainstormingSettingsService';
import { playCorrectSound, playWrongSound, playTickSound, playLockInSound, playLifelineSound } from '../../utils/quizSounds';
import {
  startTensionMusic, stopTensionMusic, speakCorrect, speakWrong, stopSpeaking,
  startCustomMusic, stopCustomMusic, playCustomSound,
} from '../../utils/quizVoice';
import type { BrainstormingItem, OptionLetter } from '../../types/brainstorming';
import type { BrainstormingSettings } from '../../types/brainstormingSettings';

const QUESTION_SECONDS = 30;

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

interface CategoryGroup {
  name: string;
  count: number;
}

function Brainstorming() {
  const [allItems, setAllItems] = useState<BrainstormingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // null means "browsing categories"; set means "playing through this category's questions".
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [queue, setQueue] = useState<BrainstormingItem[]>([]);
  const [index, setIndex] = useState(0);

  const [selected, setSelected] = useState<OptionLetter | null>(null);
  const [locked, setLocked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
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

  // Stop any in-flight music/speech if the employee navigates away.
  useEffect(() => {
    return () => {
      stopTensionMusic();
      stopCustomMusic();
      stopSpeaking();
    };
  }, []);

  const categories: CategoryGroup[] = useMemo(() => {
    const counts = new Map<string, number>();
    allItems.forEach((item) => counts.set(item.category, (counts.get(item.category) ?? 0) + 1));
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allItems]);

  const searchTerm = search.trim().toLowerCase();
  const filteredCategories = categories.filter((c) => !searchTerm || c.name.toLowerCase().includes(searchTerm));

  // Pressing the browser Back button while a category challenge is open
  // should just return to the category list on this same page — not
  // leave Brainstorming for whatever section was visited before it.
  // Pushing a history entry when a category opens means Back consumes
  // that entry first (via popstate) instead of navigating away; a
  // second Back press then behaves normally.
  useEffect(() => {
    if (!selectedCategory) return;
    window.history.pushState({ brainstorming: true }, '');
    function onPopState() {
      setSelectedCategory(null);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [selectedCategory]);

  function resetQuestionState() {
    setSelected(null);
    setLocked(false);
    setRevealed(false);
    setHiddenOptions(new Set());
    setAudiencePoll(null);
    setUsedFiftyFifty(false);
    setUsedAudience(false);
    setTimeLeft(QUESTION_SECONDS);
  }

  function openCategory(categoryName: string) {
    const items = shuffle(allItems.filter((i) => i.category === categoryName));
    setQueue(items);
    setIndex(0);
    resetQuestionState();
    setSelectedCategory(categoryName);
  }

  function backToCategories() {
    setSelectedCategory(null);
    setQueue([]);
    setIndex(0);
  }

  const current = selectedCategory ? queue[index] ?? null : null;

  // Background tension music plays for as long as a question is live
  // (not locked/revealed yet) and stops the moment it's answered.
  useEffect(() => {
    const shouldPlay = !!current && !locked && !revealed && (voiceSettings?.music_enabled ?? false);
    if (shouldPlay) {
      if (voiceSettings?.music_url) startCustomMusic(voiceSettings.music_url);
      else startTensionMusic();
    } else {
      stopTensionMusic();
      stopCustomMusic();
    }
    return () => { stopTensionMusic(); stopCustomMusic(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, locked, revealed, voiceSettings?.music_enabled, voiceSettings?.music_url]);

  // Countdown timer — stops once an answer is locked in or revealed.
  useEffect(() => {
    if (!current || locked || revealed) {
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
  }, [current?.id, locked, revealed]);

  function announce(correct: boolean) {
    if (!voiceSettings?.voice_enabled) return;
    const customUrl = correct ? voiceSettings.correct_sound_url : voiceSettings.wrong_sound_url;
    if (customUrl) {
      playCustomSound(customUrl);
      return;
    }
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
  }

  function handleSelect(letter: OptionLetter) {
    if (locked || revealed || !current) return;
    setSelected(letter);
    playLockInSound();
    setLocked(true);
    window.setTimeout(() => {
      setRevealed(true);
      if (letter === current.correct_option) {
        playCorrectSound();
        announce(true);
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
      backToCategories();
      return;
    }
    setIndex((i) => i + 1);
    resetQuestionState();
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
            <p className="mt-1 text-sm text-violet-200">Pick a category and play through its questions — just for fun, nothing is scored or recorded.</p>
          </div>
          {(streak > 0 || bestStreak > 0) && (
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

        {/* ── Category picker ── */}
        {!selectedCategory && !error && (
          <div className="mt-8">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories..."
              className="mb-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-violet-300 focus:border-amber-400/60 focus:outline-none"
            />

            {filteredCategories.length === 0 ? (
              <p className="py-10 text-center text-sm text-violet-200">
                {search ? `No categories match "${search}".` : 'No quizzes available yet.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCategories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => openCategory(cat.name)}
                    className="group flex flex-col items-start rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition hover:-translate-y-0.5 hover:border-amber-400/50 hover:bg-white/10"
                  >
                    <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-xl">
                      🧩
                    </span>
                    <p className="text-base font-bold text-white">{cat.name}</p>
                    <p className="mt-1 text-xs text-violet-200">{cat.count} question{cat.count === 1 ? '' : 's'}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-300 opacity-0 transition group-hover:opacity-100">
                      ▶ Play Challenge
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Playing through a category ── */}
        {selectedCategory && (
          <div className="mt-6">
            <button
              onClick={backToCategories}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-200 transition hover:text-white"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Back to Categories
            </button>

            {current && (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-violet-100 ring-1 ring-white/20">
                      {selectedCategory} · {index + 1} / {queue.length}
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
                      {index + 1 >= queue.length ? 'Finish Category 🎉' : 'Next Question →'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Brainstorming;
