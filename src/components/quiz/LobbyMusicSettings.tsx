// The trainer's "wait music" setting for a lobby (exam or live quiz): built-in chime, own link, or off - with a Play button so the
// trainer can hear exactly what trainees will hear before saving. The same card is used for exams and for live quizzes.

import { useEffect, useRef, useState } from "react";
import { startLobbyMusic, type LobbyMusicChoice, type LobbyMusicHandle } from "../../services/quiz/quizSoundService";

interface Props {
  title: string;
  description: string;
  choice: LobbyMusicChoice;
  url: string;
  volume: number;
  onChange: (patch: { choice?: LobbyMusicChoice; url?: string; volume?: number }) => void;
  onSave: () => void;
  saving: boolean;
  message: string;
  canEdit: boolean;
}

export default function LobbyMusicSettings({ title, description, choice, url, volume, onChange, onSave, saving, message, canEdit }: Props) {
  const handle = useRef<LobbyMusicHandle | null>(null);
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState("");

  function stop() {
    handle.current?.stop();
    handle.current = null;
    setPlaying(false);
  }

  // leaving the page stops the preview
  useEffect(() => () => handle.current?.stop(), []);

  // changing anything while it plays: stop, so what is heard is always what is on screen
  function change(patch: { choice?: LobbyMusicChoice; url?: string; volume?: number }) {
    stop();
    setNote("");
    onChange(patch);
  }

  async function play() {
    if (playing) { stop(); return; }
    if (choice === "off") { setNote("Music is off - choose the built-in chime or your own link to hear it."); return; }
    if (choice === "custom" && !url.trim()) { setNote("Paste the link of your music first."); return; }
    setNote("");
    const h = startLobbyMusic(choice, url, volume);
    handle.current = h;
    setPlaying(true);
    const result = await h.result;
    if (handle.current !== h) return;
    if (result === "playing") return;
    stop();
    setNote(
      result === "blocked"
        ? "Your browser did not allow sound yet. Press Play once more."
        : "This link could not be played. Use a direct link to an audio file (mp3 / ogg / wav) that opens without a login."
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{title}</div>
      <p className="text-xs text-slate-500">{description}</p>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <select
          disabled={!canEdit}
          className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-50"
          value={choice}
          onChange={(e) => change({ choice: e.target.value as LobbyMusicChoice })}
        >
          <option value="builtin">🔔 Built-in (gentle chime)</option>
          <option value="custom">🔗 Custom URL</option>
          <option value="off">🔇 Off</option>
        </select>
        {choice === "custom" && (
          <input
            disabled={!canEdit}
            className="flex-1 min-w-[14rem] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-50"
            placeholder="https://… (mp3/ogg URL)"
            value={url}
            onChange={(e) => change({ url: e.target.value })}
          />
        )}
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Volume
          <input
            disabled={!canEdit}
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => change({ volume: Number(e.target.value) })}
            className="w-28 disabled:opacity-50"
          />
        </label>
        <button
          type="button"
          onClick={() => void play()}
          className={`text-sm font-semibold rounded-lg px-4 py-2 border ${playing ? "border-red-500/50 bg-red-500/10 text-red-300" : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"}`}
        >
          {playing ? "■ Stop" : "▶ Play to check"}
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg px-4 py-2"
          >
            💾 {saving ? "Saving…" : "Save"}
          </button>
        )}
        {message && <span className="text-xs text-emerald-300">{message}</span>}
      </div>
      {note && <div className="text-xs text-amber-300">{note}</div>}
    </div>
  );
}
