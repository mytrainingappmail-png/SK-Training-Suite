// A PowerPoint-style "resize + frame" picture editor — pan/zoom the photo inside a chosen
// frame shape, then export a single flattened image at a sane display size. Used anywhere a
// picture is uploaded (currently: Induction thumbnails and every rich-text editor's inline
// image) so every uploaded photo:
//   1. gets a deliberate crop/frame instead of a random full-resolution dump, and
//   2. comes out much smaller in MB without looking any less sharp on screen — most phone
//      photos are 3000-4000px wide and 3-8 MB; nothing on this site displays anywhere near
//      that large, so re-encoding at a sensible max dimension loses no *visible* resolution
//      while cutting file size by 80-95%.
// Pure canvas, no new dependency — same hand-rolled-editor convention as HotspotZoneEditor.

import { useEffect, useRef, useState } from "react";

export type ImageFrame = "rectangle" | "rounded" | "square" | "circle" | "oval" | "hexagon";

const FRAME_OPTIONS: { value: ImageFrame; label: string; aspect: number; clip: "none" | "rounded" | "circle" | "oval" | "hexagon" }[] = [
  { value: "rectangle", label: "Rectangle", aspect: 16 / 9, clip: "none" },
  { value: "rounded", label: "Rounded", aspect: 16 / 9, clip: "rounded" },
  { value: "square", label: "Square", aspect: 1, clip: "none" },
  { value: "circle", label: "Circle", aspect: 1, clip: "circle" },
  { value: "oval", label: "Oval", aspect: 4 / 3, clip: "oval" },
  { value: "hexagon", label: "Hexagon", aspect: 1, clip: "hexagon" },
];

const VIEWPORT_W = 320; // on-screen preview box — output is rendered separately at OUTPUT_MAX
const OUTPUT_MAX = 1400; // longest output side, px — plenty for any on-site display size

function clipPath(frame: ImageFrame): string {
  switch (frame) {
    case "circle": return "circle(50% at 50% 50%)";
    case "oval": return "ellipse(50% 50% at 50% 50%)";
    case "hexagon": return "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
    case "rounded": return "inset(0 round 16px)";
    default: return "none";
  }
}

function applyCanvasClip(ctx: CanvasRenderingContext2D, frame: ImageFrame, w: number, h: number) {
  switch (frame) {
    case "circle": {
      const r = Math.min(w, h) / 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.clip();
      break;
    }
    case "oval":
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.clip();
      break;
    case "hexagon": {
      const pts: [number, number][] = [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]];
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px * w, py * h) : ctx.lineTo(px * w, py * h)));
      ctx.closePath();
      ctx.clip();
      break;
    }
    case "rounded": {
      const r = 24;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, r);
      ctx.clip();
      break;
    }
    default:
      break;
  }
}

/** Reads File -> HTMLImageElement, correctly awaiting decode. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function ImageEditModal({
  file,
  frames,
  defaultFrame,
  title = "Edit Photo",
  onCancel,
  onConfirm,
}: {
  file: File;
  /** Restrict which frame shapes are offered — omit for all six. */
  frames?: ImageFrame[];
  defaultFrame?: ImageFrame;
  title?: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  const allowedFrames = FRAME_OPTIONS.filter((f) => !frames || frames.includes(f.value));
  const [frame, setFrame] = useState<ImageFrame>(defaultFrame ?? allowedFrames[0].value);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadImage(file).then((i) => { if (!cancelled) setImg(i); });
    return () => { cancelled = true; };
  }, [file]);

  const active = allowedFrames.find((f) => f.value === frame) ?? allowedFrames[0];
  const viewH = VIEWPORT_W / active.aspect;

  // "cover" scale — the minimum zoom that still fills the viewport with no gaps, before the
  // user's own zoom multiplier is applied.
  function coverScale(): number {
    if (!img) return 1;
    return Math.max(VIEWPORT_W / img.naturalWidth, viewH / img.naturalHeight);
  }

  function clampOffset(next: { x: number; y: number }, scale: number): { x: number; y: number } {
    if (!img) return next;
    const dispW = img.naturalWidth * scale;
    const dispH = img.naturalHeight * scale;
    const maxX = Math.max(0, (dispW - VIEWPORT_W) / 2);
    const maxY = Math.max(0, (dispH - viewH) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, next.x)), y: Math.min(maxY, Math.max(-maxY, next.y)) };
  }

  // Re-clamp whenever zoom or frame (which changes viewH) changes, so a previous pan position
  // never leaves a gap after the viewport shape changes.
  useEffect(() => {
    setOffset((prev) => clampOffset(prev, coverScale() * zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, frame, img]);

  function onPointerDown(e: React.PointerEvent) {
    setDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset(clampOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy }, coverScale() * zoom));
  }
  function onPointerUp() {
    setDragging(false);
  }

  async function handleConfirm() {
    if (!img) return;
    setExporting(true);
    try {
      const outW = active.aspect >= 1 ? OUTPUT_MAX : Math.round(OUTPUT_MAX * active.aspect);
      const outH = Math.round(outW / active.aspect);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported.");

      applyCanvasClip(ctx, active.clip === "none" ? "rectangle" : frame, outW, outH);

      // Map the on-screen pan/zoom (in VIEWPORT_W-space) into the output canvas's own scale.
      const outScale = outW / VIEWPORT_W;
      const scale = coverScale() * zoom * outScale;
      const dispW = img.naturalWidth * scale;
      const dispH = img.naturalHeight * scale;
      const dx = outW / 2 - dispW / 2 + offset.x * outScale;
      const dy = outH / 2 - dispH / 2 + offset.y * outScale;
      ctx.drawImage(img, dx, dy, dispW, dispH);

      const needsAlpha = active.clip === "circle" || active.clip === "oval" || active.clip === "hexagon";
      const mime = needsAlpha ? "image/png" : "image/jpeg";
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed."))), mime, 0.85)
      );
      const ext = needsAlpha ? "png" : "jpg";
      const base = file.name.replace(/\.[^.]+$/, "");
      onConfirm(new File([blob], `${base}-${frame}.${ext}`, { type: mime }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not process this image.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="mb-3 text-base font-bold text-slate-900">{title}</h3>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {allowedFrames.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFrame(f.value)}
              className={`rounded-lg border-2 px-2.5 py-1.5 text-xs font-semibold transition ${
                frame === f.value ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div
          className="relative mx-auto touch-none select-none overflow-hidden rounded-xl bg-slate-900"
          style={{ width: VIEWPORT_W, height: viewH, clipPath: clipPath(frame), cursor: dragging ? "grabbing" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {img && (
            <img
              src={img.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2"
              style={{
                width: img.naturalWidth * coverScale() * zoom,
                height: img.naturalHeight * coverScale() * zoom,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
          )}
          {!img && <div className="flex h-full items-center justify-center text-xs text-slate-400">Loading…</div>}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-slate-500">Zoom</span>
          <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">Drag the photo to reposition it.</p>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!img || exporting}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {exporting ? "Processing…" : "Use This Photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
