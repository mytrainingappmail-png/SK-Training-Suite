import { useRef, useState } from "react";

import { uploadBrandingImage } from "../../repositories/quiz/quizBrandingUploadRepository";
import type { BrandingImageKind } from "../../repositories/quiz/quizBrandingUploadRepository";

interface Props {
  label: string;
  hint?: string;
  value: string | null;
  kind: BrandingImageKind;
  companyId: string;
  onChange: (url: string | null) => void;
  previewClassName?: string;
}

export default function QuizBrandingImageField({ label, hint, value, kind, companyId, onChange, previewClassName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError("");
    try {
      // Deliberately doesn't delete the previous file from storage here —
      // this only updates local form state, and the real URL isn't
      // persisted until the parent's own Save button is clicked. Deleting
      // eagerly on every replace left the database pointing at an
      // already-gone file whenever a save didn't follow (closed tab,
      // failed request, changed their mind) — the exact "logo used to
      // show, now it's just gone" bug. A little storage bloat from
      // unreferenced old images is a fine trade for never breaking a link.
      const { url } = await uploadBrandingImage(companyId, kind, file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleDelete() {
    onChange(null);
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</label>
      {hint && <p className="text-[11px] text-slate-500 mb-2">{hint}</p>}

      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className={previewClassName ?? "h-16 w-16 object-contain rounded-lg bg-slate-800 border border-slate-700"} />
        ) : (
          <div className={`${previewClassName ?? "h-16 w-16"} flex items-center justify-center rounded-lg bg-slate-800 border border-dashed border-slate-700 text-slate-600 text-xs`}>
            None
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-xs font-semibold text-slate-200 border border-slate-700 bg-slate-800 hover:bg-slate-700 rounded-lg px-3 py-1.5 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : value ? "🔁 Replace" : "⬆ Upload"}
            </button>
            {value && (
              <button
                type="button"
                onClick={handleDelete}
                className="text-xs font-semibold text-red-300 hover:text-red-200 border border-red-900/50 rounded-lg px-3 py-1.5"
              >
                🗑 Delete
              </button>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
          {error && <span className="text-[11px] text-red-300">{error}</span>}
        </div>
      </div>
    </div>
  );
}
