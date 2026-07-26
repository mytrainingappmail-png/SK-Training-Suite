import { useRef, useState } from "react";

import { renderSessionResultCardToCanvas } from "../../services/quiz/quizSessionResultCardRenderer";
import type { SessionResultCardData } from "../../services/quiz/quizSessionResultCardRenderer";

export default function QuizSessionResultCardButton({ data }: { data: SessionResultCardData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);

    try {
      renderSessionResultCardToCanvas(canvas, data);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;

      const fileName = `quiz-result-${data.quizTitle.replace(/\s+/g, "-").toLowerCase()}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Quiz Result", text: `Results for ${data.quizTitle}` });
          return;
        } catch {
          // user cancelled the share sheet — fall through to a plain download instead
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleClick}
        disabled={busy}
        className="text-sm font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-lg px-4 py-2 disabled:opacity-50"
      >
        {busy ? "Preparing…" : "📤 Download Result"}
      </button>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
