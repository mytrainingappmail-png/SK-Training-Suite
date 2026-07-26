import { useRef, useState } from "react";

import { uploadBrandingImage, deleteBrandingImageIfOwned } from "../../repositories/quiz/quizBrandingUploadRepository";
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
      const previous = value;
      const { url } = await uploadBrandingImage(companyId, kind, file);
      onChange(url);
      await deleteBrandingImageIfOwned(previous);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    const previous = value;
    onChange(null);
    await deleteBrandingImageIfOwned(previous);
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
