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

      await renderCertificateToCanvas(canvas, cert.template, {
        candidateName: cert.candidate_name,
        quizTitle: cert.quiz_title,
        scoreLine: cert.score_line,
        certNumber: cert.cert_number,
        issuedDate: new Date(cert.issued_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
        companyName: cert.company_name,
        logoUrl: cert.cert_logo_url,
        logoPosition: cert.cert_logo_position,
        logoScale: cert.cert_logo_scale,
        title: cert.cert_title,
        achievementLine: cert.achievement_line,
        signatory1Name: cert.signatory1_name,
        signatory1Title: cert.signatory1_title,
        signatory1ImageUrl: cert.signatory1_image_url,
        signatory1Scale: cert.signatory1_scale,
        signatory1NameScale: cert.signatory1_name_scale,
        signatory2Name: cert.signatory2_name,
        signatory2Title: cert.signatory2_title,
        signatory2ImageUrl: cert.signatory2_image_url,
        signatory2Scale: cert.signatory2_scale,
        signatory2NameScale: cert.signatory2_name_scale,
        signatureMode: cert.signature_mode,
        signatureAlign: cert.signature_align,
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
