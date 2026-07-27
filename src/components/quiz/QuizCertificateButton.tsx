import { useRef, useState } from "react";

import { renderCertificateToCanvas, downloadCanvasAsPng } from "../../services/quiz/quizCertificateRenderer";
import type { QuizCertificate } from "../../types/quiz";

export default function QuizCertificateButton({ cert }: { cert: QuizCertificate }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    setLoading(true);
    setError("");
    try {
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
        title: cert.cert_title,
        achievementLine: cert.achievement_line,
        signatory1Name: cert.signatory1_name,
        signatory1Title: cert.signatory1_title,
        signatory1ImageUrl: cert.signatory1_image_url,
        signatory1Scale: cert.signatory1_scale,
        signatory2Name: cert.signatory2_name,
        signatory2Title: cert.signatory2_title,
        signatory2ImageUrl: cert.signatory2_image_url,
        signatory2Scale: cert.signatory2_scale,
      });

      downloadCanvasAsPng(canvas, `certificate-${cert.cert_number}.png`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate certificate.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleDownload}
        disabled={loading}
        className="rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 disabled:opacity-50 text-amber-950 font-bold text-sm px-5 py-2.5 shadow-lg"
      >
        {loading ? "Generating…" : "🏆 Download Certificate"}
      </button>
      {error && <div className="text-xs text-red-300">{error}</div>}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
