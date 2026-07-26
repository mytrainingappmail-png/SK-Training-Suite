import { useEffect, useRef, useState } from "react";

import { playFanfare } from "../../services/quiz/quizSoundService";
import QuizConfetti from "./QuizConfetti";
import type { ChampionRow, ChampMusic } from "../../types/quiz";

const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_ORDER = [2, 1, 0]; // reveal 3rd, then 2nd, then 1st

interface Props {
  champions: ChampionRow[];
  periodTitle: string;
  music: ChampMusic;
  musicUrl: string | null;
  musicVolume: number;
  onClose: () => void;
}

export default function QuizChampionsReveal({ champions, periodTitle, music, musicUrl, musicVolume, onClose }: Props) {
  const [revealCount, setRevealCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (music === "builtin") {
      playFanfare();
    } else if (music === "custom" && musicUrl) {
      const audio = new Audio(musicUrl);
      audio.volume = Math.min(1, Math.max(0, musicVolume / 100));
      audio.play().catch(() => {});
      audioRef.current = audio;
    }

    const timers = PODIUM_ORDER.map((_, i) => setTimeout(() => setRevealCount(i + 1), (i + 1) * 900));
    return () => {
      timers.forEach(clearTimeout);
      audioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revealed = PODIUM_ORDER.slice(0, revealCount);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center gap-8 px-6">
      {revealCount >= 3 && <QuizConfetti pieceCount={140} />}

      <button
        onClick={onClose}
        className="absolute top-5 right-5 text-slate-400 hover:text-white text-sm font-semibold border border-slate-700 rounded-lg px-3 py-1.5"
      >
        ✕ Close
      </button>

      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-amber-400 font-bold mb-1">🏆 Champions</div>
        <div className="text-2xl font-bold text-white">{periodTitle || "This Period"}</div>
      </div>

      {champions.length === 0 ? (
        <div className="text-slate-500 text-sm">No qualifying trainees in this range.</div>
      ) : (
        <div className="flex items-end justify-center gap-6">
          {champions.map((c, i) => {
            const isRevealed = revealed.includes(i);
            const heights = ["h-40", "h-56", "h-32"];
            const order = i === 0 ? "order-2" : i === 1 ? "order-1" : "order-3";
            return (
              <div key={c.participant_id} className={`flex flex-col items-center ${order}`}>
                <div
                  className={`transition-all duration-700 ${
                    isRevealed ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-75"
                  }`}
                >
                  <div className="text-5xl mb-2 text-center">{MEDALS[i]}</div>
                  <div className="text-lg font-bold text-white text-center max-w-[10rem] truncate">{c.display_name}</div>
                  <div className="text-sm font-mono text-amber-400 text-center">{c.best_percent}%</div>
                  <div className="text-[10px] text-slate-500 text-center">{c.sessions_played} session(s)</div>
                </div>
                <div
                  className={`mt-4 w-28 ${heights[i]} rounded-t-xl bg-gradient-to-b from-amber-500/40 to-amber-500/10 border border-amber-500/30 transition-all duration-700 ${
                    isRevealed ? "opacity-100" : "opacity-0"
                  }`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
