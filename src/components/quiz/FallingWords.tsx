// Ambient falling-word rain, shared by the trainee landing screen and the
// exam lobby wait screen — same effect, same admin-edited word list
// (Quiz Settings), just placed wherever a trainee is looking at an
// otherwise-static waiting screen.

import { useState } from "react";

// Shown when a company hasn't customized login_motivational_words yet —
// one per line, admin-editable in Quiz Settings.
export const DEFAULT_MOTIVATIONAL_WORDS = [
  "Hardwork", "Discipline", "Consistency", "Confidence", "Growth",
  "Focus", "Excellence", "Dedication", "Learn", "Achieve",
  "Success", "Persistence", "Ambition", "Passion", "Winner",
];

export default function FallingWords({ words }: { words: string[] }) {
  // A fixed, randomized-looking layout computed once per mount (not on
  // every render) — each word gets its own horizontal spot, fall
  // duration, delay and size so the rain reads as organic, not a grid.
  const [drops] = useState(() =>
    words.map((word, i) => ({
      word,
      left: ((i * 37 + 11) % 100),
      duration: 14 + ((i * 7) % 10),
      delay: -((i * 3) % 14),
      size: 0.8 + ((i % 4) * 0.15),
      opacity: 0.12 + ((i % 3) * 0.07),
    }))
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes quiz-word-fall {
          0% { transform: translateY(-10vh); }
          100% { transform: translateY(110vh); }
        }
      `}</style>
      {drops.map((d, i) => (
        <span
          key={i}
          className="absolute top-0 font-bold text-amber-300 whitespace-nowrap select-none"
          style={{
            left: `${d.left}%`,
            fontSize: `${d.size}rem`,
            opacity: d.opacity,
            animation: `quiz-word-fall ${d.duration}s linear ${d.delay}s infinite`,
          }}
        >
          {d.word}
        </span>
      ))}
    </div>
  );
}
