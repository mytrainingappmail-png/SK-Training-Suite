// "Play to check" for a music setting that has no card of its own (the champions music): plays exactly what the trainees / the TV will
// hear - the built-in fanfare, or the trainer's own file - so it can be checked before saving.

import { useEffect, useRef, useState } from "react";
import { playFanfare } from "../../services/quiz/quizSoundService";

interface Props {
  choice: "builtin" | "custom" | "off";
  url: string;
  volume: number;
}

export default function MusicCheckButton({ choice, url, volume }: Props) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState("");

  function stop() {
    audio.current?.pause();
    audio.current = null;
    setPlaying(false);
  }
  // leaving the page, or changing the choice / link / volume, stops the preview
  useEffect(() => stop, []);
  useEffect(() => { stop(); setNote(""); }, [choice, url, volume]);

  async function play() {
    if (playing) { stop(); return; }
    setNote("");
    if (choice === "off") { setNote("Music is off - choose the built-in sound or your own music to hear it."); return; }
    if (choice === "builtin") { playFanfare(); return; }
    if (!url.trim()) { setNote("Upload an mp3 or paste the link of your music first."); return; }
    const a = new Audio(url.trim());
    a.volume = Math.min(1, Math.max(0, volume / 100));
    a.onended = () => setPlaying(false);
    audio.current = a;
    setPlaying(true);
    try {
      await a.play();
    } catch (e) {
      stop();
      setNote(e instanceof DOMException && e.name === "NotAllowedError"
        ? "Your browser did not allow sound yet. Press Play once more."
        : "This link could not be played. Use a direct link to an audio file (mp3 / ogg / wav) that opens without a login.");
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void play()}
        className={`text-sm font-semibold rounded-lg px-4 py-2 border ${playing ? "border-red-500/50 bg-red-500/10 text-red-300" : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"}`}
      >
        {playing ? "■ Stop" : "▶ Play to check"}
      </button>
      {note && <span className="text-xs text-amber-300">{note}</span>}
    </span>
  );
}
