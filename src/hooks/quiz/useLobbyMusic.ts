// Plays the trainer's chosen wait music while a trainee sits in a lobby (exam or live quiz). If the phone has not allowed
// sound yet, `blocked` is true so the screen can show a "tap to play" prompt; the music also starts on the very next touch.

import { useCallback, useEffect, useRef, useState } from "react";
import { startLobbyMusic, type LobbyMusicChoice, type LobbyMusicHandle } from "../../services/quiz/quizSoundService";

interface Options {
  /** True while the lobby screen is showing. */
  active: boolean;
  /** The trainee did not mute it. */
  on: boolean;
  choice: LobbyMusicChoice;
  url: string | null | undefined;
  volume: number;
}

export function useLobbyMusic({ active, on, choice, url, volume }: Options): { blocked: boolean; playNow: () => void } {
  const [blocked, setBlocked] = useState(false);
  const handle = useRef<LobbyMusicHandle | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active || !on || choice === "off") return;
    let cancelled = false;
    const h = startLobbyMusic(choice, url, volume);
    handle.current = h;
    void h.result.then((r) => { if (!cancelled) setBlocked(r === "blocked"); });
    return () => {
      cancelled = true;
      h.stop();
      if (handle.current === h) handle.current = null;
    };
  }, [active, on, choice, url, volume, attempt]);

  // blocked: the next touch anywhere on the page (a real gesture) lets the music start
  useEffect(() => {
    if (!blocked) return;
    const retry = () => setAttempt((n) => n + 1);
    const events = ["pointerdown", "keydown", "touchend"] as const;
    events.forEach((e) => document.addEventListener(e, retry, { once: true }));
    return () => events.forEach((e) => document.removeEventListener(e, retry));
  }, [blocked]);

  const playNow = useCallback(() => setAttempt((n) => n + 1), []);
  // "blocked" only matters while music should be playing
  return { blocked: blocked && active && on && choice !== "off", playNow };
}
