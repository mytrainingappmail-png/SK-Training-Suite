// Shown ONLY on the result screen of the trainee who is the TOPPER (rank 1, passed): plays the music the trainer uploaded for
// topper (Quiz Results -> "Topper's own phone music"), with the same player card (beats + ON/OFF) as the wait music.
// Nobody else ever sees or hears it. If the trainer has it switched off, nothing is shown.

import { useEffect, useState } from "react";
import { useLobbyMusic } from "../../hooks/quiz/useLobbyMusic";
import { getMyTopperMusic, type TopperMusic } from "../../repositories/quiz/quizSettingsRepository";
import LobbyMusicPlayer from "./LobbyMusicPlayer";

export default function TopperMusicCard({ kind, sessionId }: { kind: "quiz" | "exam"; sessionId: string }) {
  const [music, setMusic] = useState<TopperMusic | null>(null);
  const [on, setOn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getMyTopperMusic(kind, sessionId).then((m) => { if (!cancelled) setMusic(m); });
    return () => { cancelled = true; };
  }, [kind, sessionId]);

  const player = useLobbyMusic({
    active: !!music,
    on,
    choice: "custom",
    url: music?.url,
    volume: music?.volume ?? 80,
  });

  if (!music) return null;
  return (
    <div className="mt-4">
      <LobbyMusicPlayer label="🏆 Topper's music" on={on} onToggle={() => setOn((v) => !v)} blocked={player.blocked} onPlayNow={player.playNow} />
    </div>
  );
}
