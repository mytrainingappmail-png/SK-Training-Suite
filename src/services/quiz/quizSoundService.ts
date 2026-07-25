// Lightweight synthesized sound effects (Web Audio API oscillator) — no
// audio files to host/upload, matches the reference app's "built-in"
// sound option. Gated by the company's sound_enabled setting at the call
// site, not in here.

type ToneKind = "pop" | "tick" | "correct" | "wrong";

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    return audioCtx;
  } catch {
    return null;
  }
}

const TONE_PRESETS: Record<ToneKind, { freq: number; duration: number; type: OscillatorType }> = {
  pop: { freq: 660, duration: 0.08, type: "sine" },
  tick: { freq: 440, duration: 0.05, type: "square" },
  correct: { freq: 880, duration: 0.18, type: "sine" },
  wrong: { freq: 220, duration: 0.22, type: "sawtooth" },
};

export function playTone(kind: ToneKind): void {
  const ctx = getContext();
  if (!ctx) return;

  const { freq, duration, type } = TONE_PRESETS[kind];
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = freq;
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}
