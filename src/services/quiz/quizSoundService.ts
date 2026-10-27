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

/** Built-in "fanfare + clapping" for the Champions reveal — a short ascending arpeggio followed by noise-burst "claps", no audio file needed. */
export function playFanfare(): void {
  const ctx = getContext();
  if (!ctx) return;

  const notes = [523.25, 659.25, 784.0, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const start = ctx.currentTime + i * 0.16;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  });

  const clapStart = ctx.currentTime + notes.length * 0.16 + 0.1;
  for (let c = 0; c < 4; c++) {
    const start = clapStart + c * 0.14;
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
    noise.connect(gain);
    gain.connect(ctx.destination);
    noise.start(start);
  }
}

/**
 * Built-in "waiting room" ambience for the Exam lobby (candidate joined
 * early, waiting on exam_sessions.opens_at) — a soft, unlooping-sounding
 * bell phrase that repeats every ~4.5s, gentle enough to sit under for
 * minutes at a time (unlike playFanfare, which is a one-shot celebration
 * sound). No audio file — synthesized like the rest of this service, so
 * an admin who wants a real track still supplies one via the "custom" URL
 * option; this is only the no-setup default. Returns a stop() to call on
 * unmount/lobby-end.
 */
export function startLobbyAmbience(volumePercent: number): () => void {
  const ctx = getContext();
  if (!ctx) return () => {};

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const peakGain = Math.min(1, Math.max(0, volumePercent / 100)) * 0.2;
  const notes = [523.25, 587.33, 659.25, 784.0, 659.25, 587.33]; // C5 D5 E5 G5 E5 D5
  let i = 0;

  function playNote() {
    if (stopped) return;
    const c = getContext();
    if (c) {
      const freq = notes[i % notes.length];
      const start = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peakGain, start + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.3);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(start);
      osc.stop(start + 1.4);
    }
    i++;
    timer = setTimeout(playNote, 750);
  }
  playNote();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

// ── Lobby wait music (exam and live quiz), shared by the trainee's lobby and the trainer's "play to check" button ──────────
// Browsers refuse to play sound until the person has touched the page, and they leave a freshly created audio context
// "suspended". So starting music can end three ways: "playing", "blocked" (needs a tap first - the caller shows a tap-to-play
// prompt and tries again on the next touch) or "failed" (e.g. a custom link that is not an audio file).

export type LobbyMusicChoice = "builtin" | "custom" | "off";
export type LobbyMusicResult = "playing" | "blocked" | "failed";

export interface LobbyMusicHandle {
  stop: () => void;
  result: Promise<LobbyMusicResult>;
}

export function startLobbyMusic(choice: LobbyMusicChoice, url: string | null | undefined, volumePercent: number): LobbyMusicHandle {
  let stopFn: (() => void) | null = null;
  let cancelled = false;
  const stop = () => {
    cancelled = true;
    stopFn?.();
    stopFn = null;
  };
  const volume = Math.min(1, Math.max(0, volumePercent / 100));

  if (choice === "custom" && url && url.trim()) {
    const audio = new Audio(url.trim());
    audio.loop = true;
    audio.volume = volume;
    stopFn = () => { audio.pause(); audio.removeAttribute("src"); audio.load(); };
    const result = audio
      .play()
      .then((): LobbyMusicResult => (cancelled ? "failed" : "playing"))
      .catch((e: unknown): LobbyMusicResult => (e instanceof DOMException && e.name === "NotAllowedError" ? "blocked" : "failed"));
    return { stop, result };
  }

  if (choice === "builtin") {
    const ctx = getContext();
    if (!ctx) return { stop, result: Promise.resolve("failed") };
    const result = new Promise<LobbyMusicResult>((resolve) => {
      // a context that was never allowed to start keeps resume() pending - give it a moment, then report "blocked"
      const giveUp = setTimeout(() => resolve("blocked"), 700);
      ctx.resume().then(() => {
        clearTimeout(giveUp);
        if (cancelled) return resolve("failed");
        if (ctx.state === "running") {
          stopFn = startLobbyAmbience(volumePercent);
          resolve("playing");
        } else {
          resolve("blocked");
        }
      }).catch(() => { clearTimeout(giveUp); resolve("blocked"); });
    });
    return { stop, result };
  }

  return { stop, result: Promise.resolve("failed") };
}
