// "Upload music from this phone / computer" - shared by the live-quiz wait music, the exam wait music and the champions music.
// The chosen file is stored online and its link is handed back, so everything that already plays a custom link plays it as it is.

import { useRef, useState } from "react";
import { getCurrentQuizAdmin } from "../../services/quiz/quizAdminSession";
import { uploadQuizMusic } from "../../repositories/quiz/quizBrandingUploadRepository";

export default function MusicUploadButton({ disabled, onUploaded }: { disabled?: boolean; onUploaded: (url: string, fileName: string) => void }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const admin = getCurrentQuizAdmin();
    if (!admin) { setError("Please sign in again."); return; }
    setError("");
    setBusy(true);
    try {
      const up = await uploadQuizMusic(admin.company_id, file);
      onUploaded(up.url, up.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The music could not be uploaded.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <input ref={input} type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
        className="text-sm font-semibold rounded-lg px-3 py-2 border border-sky-500/50 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "⬆ Upload mp3 from device"}
      </button>
      {error && <span className="text-xs text-amber-300">{error}</span>}
    </span>
  );
}
