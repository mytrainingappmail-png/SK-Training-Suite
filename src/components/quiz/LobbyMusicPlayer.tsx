// The trainee's wait-music card in a quiz / exam lobby: a small music player with dancing beat bars and a clear ON / OFF switch.
// The bars move only while the music is really playing; if the phone has not allowed sound yet, a big "Tap to play" button shows.

interface Props {
  /** The trainee has the music switched on. */
  on: boolean;
  onToggle: () => void;
  /** The phone is waiting for a tap before it lets sound start. */
  blocked: boolean;
  onPlayNow: () => void;
}

const BARS = [0.55, 0.9, 0.4, 1, 0.65, 0.85, 0.5, 0.95, 0.6];

export default function LobbyMusicPlayer({ on, onToggle, blocked, onPlayNow }: Props) {
  const playing = on && !blocked;
  return (
    <div className="w-full max-w-xs mx-auto rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-left">
      <style>{`
        @keyframes lobby-beat { 0%, 100% { transform: scaleY(0.25); } 50% { transform: scaleY(1); } }
        @media (prefers-reduced-motion: reduce) { .lobby-beat-bar { animation: none !important; transform: scaleY(0.6) !important; } }
      `}</style>
      <div className="flex items-center gap-3">
        <div className="flex items-end gap-[3px] h-9 w-16 flex-shrink-0" aria-hidden="true">
          {BARS.map((h, i) => (
            <span
              key={i}
              className={`lobby-beat-bar flex-1 rounded-sm origin-bottom ${playing ? "bg-amber-400" : "bg-slate-600"}`}
              style={{
                height: `${h * 100}%`,
                transform: playing ? undefined : "scaleY(0.25)",
                animation: playing ? `lobby-beat ${0.55 + (i % 4) * 0.17}s ease-in-out ${i * 0.07}s infinite` : "none",
              }}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">♪ Wait music</div>
          <div className={`text-sm font-bold ${playing ? "text-amber-300" : "text-slate-400"}`}>
            {!on ? "Off" : blocked ? "Tap to start" : "Playing"}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={on ? "Turn the music off" : "Turn the music on"}
          onClick={onToggle}
          className={`relative h-8 w-[4.25rem] flex-shrink-0 rounded-full border transition-colors ${on ? "bg-amber-400 border-amber-300" : "bg-slate-700 border-slate-600"}`}
        >
          <span className={`absolute top-1/2 -translate-y-1/2 text-[10px] font-black ${on ? "left-2 text-amber-950" : "right-2 text-slate-300"}`}>{on ? "ON" : "OFF"}</span>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[2.4rem]" : "left-1"}`} />
        </button>
      </div>
      {on && blocked && (
        <button type="button" onClick={onPlayNow} className="mt-3 w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-amber-950 hover:bg-amber-300">
          ▶ Tap to play the music
        </button>
      )}
    </div>
  );
}
