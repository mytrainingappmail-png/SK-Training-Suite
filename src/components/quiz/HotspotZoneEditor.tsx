// Lets a quiz admin upload an image (a map/floor-plan/diagram) and click on
// it to mark the ONE correct spot for a "hotspot" question — used by
// QuizBuilderPage.tsx. Target position/radius are all percentages of the
// image's own width/height (0-100), which is what makes them meaningful
// regardless of what size the image later renders at for a trainee on
// their phone.

import { useRef, useState } from "react";
import { uploadBrandingImage } from "../../repositories/quiz/quizBrandingUploadRepository";

const DEFAULT_RADIUS = 6;
const MIN_RADIUS = 2;
const MAX_RADIUS = 20;

interface Props {
  companyId: string;
  imageUrl: string | null;
  targetX: number | null;
  targetY: number | null;
  targetRadius: number | null;
  onChange: (patch: { image_url?: string | null; target_x?: number | null; target_y?: number | null; target_radius?: number | null }) => void;
}

export default function HotspotZoneEditor({ companyId, imageUrl, targetX, targetY, targetRadius, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const radius = targetRadius ?? DEFAULT_RADIUS;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const { url } = await uploadBrandingImage(companyId, "question-image", file);
      // A fresh image means any previously-marked spot is meaningless —
      // force the admin to mark it again rather than silently keeping a
      // target that now points at unrelated content.
      onChange({ image_url: url, target_x: null, target_y: null, target_radius: DEFAULT_RADIUS });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onChange({ target_x: Math.round(x * 10) / 10, target_y: Math.round(y * 10) / 10 });
  }

  if (!imageUrl) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/60 p-6 text-center">
        <p className="text-sm text-slate-400 mb-3">Upload the image trainees will tap on (a map, floor plan, diagram…).</p>
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-lg px-4 py-2 cursor-pointer">
          {uploading ? "Uploading…" : "⬆ Upload Image"}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        {uploadError && <p className="text-xs text-rose-400 mt-2">{uploadError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">
        {targetX === null ? "Click on the image below to mark the correct spot." : "Click again to move the marked spot."}
      </p>
      <div className="relative inline-block max-w-full rounded-xl overflow-hidden border border-slate-700">
        <img
          src={imageUrl}
          alt="Hotspot question"
          onClick={handleImageClick}
          className="block max-w-full h-auto cursor-crosshair select-none"
          draggable={false}
        />
        {targetX !== null && targetY !== null && (
          <div
            className="absolute rounded-full border-2 border-emerald-400 bg-emerald-400/25 pointer-events-none -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${targetX}%`, top: `${targetY}%`, width: `${radius * 2}%`, aspectRatio: "1 / 1" }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold text-slate-300 cursor-pointer hover:text-white">
          🔄 Replace Image
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Tap tolerance</span>
          <input
            type="range"
            min={MIN_RADIUS}
            max={MAX_RADIUS}
            value={radius}
            onChange={(e) => onChange({ target_radius: Number(e.target.value) })}
            className="w-28"
          />
          <span className="font-mono text-slate-300 w-8">{radius}%</span>
        </div>
      </div>
      {uploadError && <p className="text-xs text-rose-400">{uploadError}</p>}
    </div>
  );
}
