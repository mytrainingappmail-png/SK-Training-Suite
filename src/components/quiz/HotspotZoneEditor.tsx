// Lets a quiz admin upload an image (a map/floor-plan/diagram) and mark the
// correct area(s) on it for a "hotspot" question — used by QuizBuilderPage.tsx.
// Areas are circles, rectangles or freehand shapes, in percentages of the
// image's own width/height (0-100), which is what makes them meaningful
// regardless of what size the image later renders at for a trainee on
// their phone. See hotspotZones.tsx for the marking panel itself.

import { useRef, useState } from "react";
import { uploadBrandingImage } from "../../repositories/quiz/quizBrandingUploadRepository";
import type { HotspotZone } from "../../types/quiz";
import { HotspotZonePanel, legacyFromZones } from "./hotspotZones";

export interface HotspotEditorPatch {
  image_url?: string | null;
  target_x?: number | null;
  target_y?: number | null;
  target_radius?: number | null;
  hotspot_zones?: HotspotZone[] | null;
}

interface Props {
  companyId: string;
  imageUrl: string | null;
  zones: HotspotZone[];
  onChange: (patch: HotspotEditorPatch) => void;
}

export default function HotspotZoneEditor({ companyId, imageUrl, zones, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const { url } = await uploadBrandingImage(companyId, "question-image", file);
      // A fresh image means any previously-marked area is meaningless —
      // force the admin to mark it again rather than silently keeping
      // areas that now point at unrelated content.
      onChange({ image_url: url, hotspot_zones: null, ...legacyFromZones([]) });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleZonesChange(next: HotspotZone[]) {
    onChange({ hotspot_zones: next.length > 0 ? next : null, ...legacyFromZones(next) });
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
      <HotspotZonePanel imageUrl={imageUrl} zones={zones} onZonesChange={handleZonesChange} />
      <label className="inline-block text-xs font-semibold text-slate-300 cursor-pointer hover:text-white">
        🔄 Replace Image
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
      </label>
      {uploadError && <p className="text-xs text-rose-400">{uploadError}</p>}
    </div>
  );
}
