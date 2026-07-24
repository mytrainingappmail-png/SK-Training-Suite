// Lightweight sound effects generated in-browser via the Web Audio API —
// no external audio files, so nothing to host and no licensing/copyright
// concerns (these are original tones, not any show's actual music).

let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq: number, startTime: number, duration: number, type: OscillatorType = 'sine', gain = 0.15): void {
  const audioCtx = getContext();
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startTime);
  gainNode.gain.setValueAtTime(gain, audioCtx.currentTime + startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + startTime + duration);
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.start(audioCtx.currentTime + startTime);
  osc.stop(audioCtx.currentTime + startTime + duration);
}

/** A bright rising two-note chime for a correct answer. */
export function playCorrectSound(): void {
  tone(523.25, 0, 0.18, 'sine', 0.18);
  tone(659.25, 0.12, 0.22, 'sine', 0.18);
  tone(783.99, 0.24, 0.3, 'sine', 0.16);
}

/** A low buzzing tone for a wrong answer. */
export function playWrongSound(): void {
  tone(146.83, 0, 0.35, 'sawtooth', 0.12);
  tone(110, 0.1, 0.35, 'sawtooth', 0.1);
}

/** A short tick used once per second in the final seconds of the timer. */
export function playTickSound(): void {
  tone(880, 0, 0.06, 'square', 0.06);
}

/** A quick confirming click when an option is locked in. */
export function playLockInSound(): void {
  tone(440, 0, 0.08, 'triangle', 0.12);
}

/** A short fanfare-ish flourish when a lifeline is used. */
export function playLifelineSound(): void {
  tone(392, 0, 0.1, 'sine', 0.12);
  tone(523.25, 0.08, 0.15, 'sine', 0.12);
}
