// Spoken "announcer" reactions and background tension music for the
// Brainstorming quiz. Uses the browser's own text-to-speech engine
// (window.speechSynthesis) with a chosen system voice + a pitch/rate
// preset that gives it a distinct game-show-host feel — this is NOT a
// clone or impression of any real person's voice, just the browser's
// stock TTS tuned differently per preset.

import type { BrainstormingVoiceStyle } from '../types/brainstormingSettings';

const CORRECT_PHRASES = [
  'Sahi jawab! Zabardast!',
  "Correct! You're on fire!",
  'Waah! Bilkul sahi jawab!',
  'Excellent! That is absolutely correct!',
  'Shandaar! Right answer!',
];

const WRONG_PHRASES = [
  'Ohh... galat jawab.',
  'Not quite — that is incorrect.',
  'Arre yaar, galat ho gaya.',
  'Oops! Wrong answer.',
  'Ohh, so close, but no.',
];

const VOICE_PRESETS: Record<BrainstormingVoiceStyle, { pitch: number; rate: number }> = {
  classic:   { pitch: 1,    rate: 0.95 },
  energetic: { pitch: 1.3,  rate: 1.15 },
  dramatic:  { pitch: 0.75, rate: 0.82 },
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

interface SpeakOptions {
  style: BrainstormingVoiceStyle;
  voiceURI?: string;
}

function speakText(text: string, opts: SpeakOptions): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const preset = VOICE_PRESETS[opts.style] ?? VOICE_PRESETS.classic;
  utter.pitch = preset.pitch;
  utter.rate = preset.rate;
  if (opts.voiceURI) {
    const voice = listVoices().find((v) => v.voiceURI === opts.voiceURI);
    if (voice) utter.voice = voice;
  }
  window.speechSynthesis.speak(utter);
}

export function speakCorrect(opts: SpeakOptions): void {
  speakText(pick(CORRECT_PHRASES), opts);
}

export function speakWrong(opts: SpeakOptions): void {
  speakText(pick(WRONG_PHRASES), opts);
}

export function speakSample(opts: SpeakOptions, correct: boolean): void {
  if (correct) speakCorrect(opts);
  else speakWrong(opts);
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// ── Background tension music ────────────────────────────────────────────────
// A simple looping suspenseful arpeggio, generated live via Web Audio —
// no external audio files, same approach as quizSounds.ts.

let musicCtx: AudioContext | null = null;
let musicTimer: ReturnType<typeof setTimeout> | null = null;

function getMusicContext(): AudioContext {
  if (!musicCtx) musicCtx = new AudioContext();
  if (musicCtx.state === 'suspended') musicCtx.resume();
  return musicCtx;
}

const TENSION_NOTES = [220, 261.63, 293.66, 329.63, 293.66, 261.63];

export function startTensionMusic(): void {
  stopTensionMusic();
  const ctx = getMusicContext();
  let i = 0;

  function playNote() {
    const freq = TENSION_NOTES[i % TENSION_NOTES.length];
    i += 1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    musicTimer = setTimeout(playNote, 380);
  }

  playNote();
}

export function stopTensionMusic(): void {
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}
