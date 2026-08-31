import { useRef, useState } from "react";

import { issueCertificateForParticipant, updateCertificatePhoto } from "../../repositories/quiz/quizCertificateRepository";
import { uploadBrandingImage } from "../../repositories/quiz/quizBrandingUploadRepository";
import { renderCertificateToCanvas, downloadCanvasAsPng } from "../../services/quiz/quizCertificateRenderer";
import type { QuizCertificate } from "../../types/quiz";

/** Lets the HOST hand out a certificate straight from the TV/live screen — the trainee doesn't need their own device. */
export default function QuizAdminCertificateButton({ participantId, companyId }: { participantId: string; companyId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cert, setCert] = useState<QuizCertificate | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");

  async function renderAndDownload(c: QuizCertificate) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    await renderCertificateToCanvas(canvas, c.template, {
      candidateName: c.candidate_name,
      quizTitle: c.quiz_title,
      scoreLine: c.score_line,
      certNumber: c.cert_number,
      issuedDate: new Date(c.issued_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
      companyName: c.company_name,
      companyNameAlign: c.company_name_align,
      logoUrl: c.cert_logo_url,
      logoPosition: c.cert_logo_position,
      logoScale: c.cert_logo_scale,
      watermarkType: c.cert_watermark_type,
      watermarkText: c.cert_watermark_text,
      title: c.cert_title,
      achievementLine: c.achievement_line,
      signatory1Name: c.signatory1_name,
      signatory1Title: c.signatory1_title,
      signatory1ImageUrl: c.signatory1_image_url,
      signatory1Scale: c.signatory1_scale,
      signatory1NameScale: c.signatory1_name_scale,
      signatory2Name: c.signatory2_name,
      signatory2Title: c.signatory2_title,
      signatory2ImageUrl: c.signatory2_image_url,
      signatory2Scale: c.signatory2_scale,
      signatory2NameScale: c.signatory2_name_scale,
      signatureMode: c.signature_mode,
      signatureAlign: c.signature_align,
      photoEnabled: c.photo_enabled,
      photoUrl: c.candidate_photo_url,
      photoFrame: c.cert_photo_frame,
      awardSeal: c.cert_award_seal,
    });

    downloadCanvasAsPng(canvas, `certificate-${c.cert_number}.png`);
  }

  async function handleDownload() {
    setLoading(true);
    setError("");
    try {
      const issued = await issueCertificateForParticipant(participantId);
      setCert(issued);
      await renderAndDownload(issued);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate certificate.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !cert) return;

    setUploadingPhoto(true);
    setError("");
    try {
      const { url } = await uploadBrandingImage(companyId, "candidate-photo", file);
      await updateCertificatePhoto(cert.id, url);
      const updated = { ...cert, candidate_photo_url: url };
      setCert(updated);
      await renderAndDownload(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach the photo.");
    } finally {
      setUploadingPhoto(false);
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
      {cert?.photo_enabled && (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingPhoto}
            title={cert.candidate_photo_url ? "Replace the candidate's photo" : "Attach the candidate's photo"}
            className="text-xs font-semibold border border-slate-700 text-slate-300 hover:text-white disabled:opacity-50 rounded-lg px-2.5 py-1.5"
          >
            {uploadingPhoto ? "…" : cert.candidate_photo_url ? "📷 ✓" : "📷 Add Photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} />
        </>
      )}
      {error && <span className="text-[11px] text-red-300">{error}</span>}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
