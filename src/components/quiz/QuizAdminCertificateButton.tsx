import { useRef, useState } from "react";

import { issueCertificateForParticipant } from "../../repositories/quiz/quizCertificateRepository";
import { renderCertificateToCanvas, downloadCanvasAsPng } from "../../services/quiz/quizCertificateRenderer";

/** Lets the HOST hand out a certificate straight from the TV/live screen — the trainee doesn't need their own device. */
export default function QuizAdminCertificateButton({ participantId }: { participantId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    setLoading(true);
    setError("");
    try {
      const cert = await issueCertificateForParticipant(participantId);
      const canvas = canvasRef.current;
      if (!canvas) return;

      renderCertificateToCanvas(canvas, cert.template, {
        candidateName: cert.candidate_name,
        quizTitle: cert.quiz_title,
        scoreLine: cert.score_line,
        certNumber: cert.cert_number,
        issuedDate: new Date(cert.issued_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
        companyName: cert.company_name,
        title: cert.cert_title,
        achievementLine: cert.achievement_line,
        signatory1Name: cert.signatory1_name,
        signatory1Title: cert.signatory1_title,
        signatory2Name: cert.signatory2_name,
        signatory2Title: cert.signatory2_title,
      });

      downloadCanvasAsPng(canvas, `certificate-${cert.cert_number}.png`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate certificate.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDownload}
        disabled={loading}
        className="text-xs font-semibold bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-amber-950 rounded-lg px-3 py-1.5"
      >
        {loading ? "…" : "↓ Certificate"}
      </button>
      {error && <span className="text-[11px] text-red-300">{error}</span>}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
