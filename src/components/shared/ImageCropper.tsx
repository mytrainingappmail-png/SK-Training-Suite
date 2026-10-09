// Crop a picture: drag the frame or its corners / edges to choose the part to keep, optionally lock a shape
// (square, 4:3, 16:9, …), rotate it a quarter-turn, and save. Pure canvas, no dependency. The original file is never
// touched — the caller gets a NEW cropped picture and decides what to do with it.

import { useEffect, useMemo, useRef, useState } from "react";

interface Rect { x: number; y: number; w: number; h: number } // all 0..1 of the picture
type Handle = "move" | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const RATIOS: { label: string; value: number | null }[] = [
  { label: "Free", value: null },
  { label: "Square", value: 1 },
  { label: "4 : 3", value: 4 / 3 },
  { label: "3 : 4", value: 3 / 4 },
  { label: "16 : 9", value: 16 / 9 },
  { label: "9 : 16", value: 9 / 16 },
];
const MIN = 0.05;
const OUTPUT_MAX = 2000;

async function loadSource(src: string): Promise<{ img: HTMLImageElement; type: string }> {
  let url = src;
  let type = "image/jpeg";
  if (!src.startsWith("blob:") && !src.startsWith("data:")) {
    const res = await fetch(src, { mode: "cors" });
    if (!res.ok) throw new Error("The picture could not be loaded.");
    const blob = await res.blob();
    type = blob.type || type;
    url = URL.createObjectURL(blob);
  }
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("The picture could not be opened."));
    i.src = url;
  });
  return { img, type };
}

/** The picture drawn onto a canvas after `turns` quarter-turns. */
function rotated(img: HTMLImageElement, turns: number): HTMLCanvasElement {
  const t = ((turns % 4) + 4) % 4;
  const c = document.createElement("canvas");
  const swap = t % 2 === 1;
  c.width = swap ? img.naturalHeight : img.naturalWidth;
  c.height = swap ? img.naturalWidth : img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((t * Math.PI) / 2);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return c;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export default function ImageCropper({ src, title = "Crop picture", onCancel, onSave }: {
  src: string;
  title?: string;
  onCancel: () => void;
  onSave: (file: File) => void | Promise<void>;
}) {
  const [source, setSource] = useState<{ img: HTMLImageElement; type: string } | null>(null);
  const [error, setError] = useState("");
  const [turns, setTurns] = useState(0);
  const [ratio, setRatio] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect>({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: Handle; start: { x: number; y: number }; orig: Rect } | null>(null);

  useEffect(() => {
    let alive = true;
    loadSource(src).then((s) => alive && setSource(s)).catch((e) => alive && setError(e instanceof Error ? e.message : "The picture could not be loaded."));
    return () => { alive = false; };
  }, [src]);

  // the picture as shown — re-made only when the file or the rotation changes, never while dragging the frame
  const canvas = useMemo(() => (source ? rotated(source.img, turns) : null), [source, turns]);
  const shownUrl = useMemo(() => (canvas ? canvas.toDataURL("image/jpeg", 0.92) : null), [canvas]);

  const aspect = canvas ? canvas.width / canvas.height : 1; // picture width / height

  /** Largest centred frame of a given shape (shape = frame width / frame height in real pixels). */
  function frameFor(shape: number): Rect {
    // frame in 0..1 units: w/h (in pixels) = (w*W)/(h*H) = shape  =>  h = w * aspect / shape
    let w = 0.9;
    let h = (w * aspect) / shape;
    if (h > 0.9) { h = 0.9; w = (h * shape) / aspect; }
    return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
  }

  function chooseRatio(v: number | null) {
    setRatio(v);
    if (v !== null) setRect(frameFor(v));
    setDirty(true);
  }

  function rotate() {
    setTurns((t) => t + 1);
    setRect({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 });
    setRatio(null);
    setDirty(true);
  }

  function pointer(e: React.PointerEvent): { x: number; y: number } {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  function begin(e: React.PointerEvent, handle: Handle) {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { handle, start: pointer(e), orig: rect };
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = pointer(e);
    const dx = p.x - d.start.x, dy = p.y - d.start.y;
    const o = d.orig;
    if (d.handle === "move") {
      setRect({ ...o, x: clamp(o.x + dx, 0, 1 - o.w), y: clamp(o.y + dy, 0, 1 - o.h) });
      setDirty(true);
      return;
    }
    let left = o.x, top = o.y, right = o.x + o.w, bottom = o.y + o.h;
    if (d.handle.includes("w")) left = clamp(o.x + dx, 0, right - MIN);
    if (d.handle.includes("e")) right = clamp(o.x + o.w + dx, left + MIN, 1);
    if (d.handle.includes("n")) top = clamp(o.y + dy, 0, bottom - MIN);
    if (d.handle.includes("s")) bottom = clamp(o.y + o.h + dy, top + MIN, 1);
    if (ratio !== null && d.handle.length === 2) {
      // a locked shape follows the width; the height is derived and the frame is kept inside the picture
      let w = right - left;
      let h = (w * aspect) / ratio;
      const anchorX = d.handle.includes("w") ? right : left;
      const anchorY = d.handle.includes("n") ? bottom : top;
      const maxW = d.handle.includes("w") ? anchorX : 1 - anchorX;
      const maxH = d.handle.includes("n") ? anchorY : 1 - anchorY;
      if (h > maxH) { h = maxH; w = (h * ratio) / aspect; }
      if (w > maxW) { w = maxW; h = (w * aspect) / ratio; }
      left = d.handle.includes("w") ? anchorX - w : anchorX;
      right = left + w;
      top = d.handle.includes("n") ? anchorY - h : anchorY;
      bottom = top + h;
    }
    setRect({ x: left, y: top, w: right - left, h: bottom - top });
    setDirty(true);
  }

  async function save() {
    if (!canvas || !source) return;
    setSaving(true);
    try {
      const sx = Math.round(rect.x * canvas.width), sy = Math.round(rect.y * canvas.height);
      const sw = Math.max(1, Math.round(rect.w * canvas.width)), sh = Math.max(1, Math.round(rect.h * canvas.height));
      const scale = Math.min(1, OUTPUT_MAX / Math.max(sw, sh));
      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.round(sw * scale));
      out.height = Math.max(1, Math.round(sh * scale));
      out.getContext("2d")!.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
      const png = source.type === "image/png";
      const blob: Blob = await new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not crop the picture."))), png ? "image/png" : "image/jpeg", 0.92));
      await onSave(new File([blob], `cropped-${Date.now()}.${png ? "png" : "jpg"}`, { type: blob.type }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the cropped picture. Please try again.");
      setSaving(false);
    }
  }

  function cancel() {
    if (dirty && !confirm("Close without saving? Your crop will be lost.")) return;
    onCancel();
  }

  const pct = (n: number) => `${n * 100}%`;
  const dot = "absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-500 shadow";
  const edge = "absolute bg-transparent";
  const pxW = canvas ? Math.round(rect.w * canvas.width) : 0;
  const pxH = canvas ? Math.round(rect.h * canvas.height) : 0;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950 text-slate-100">
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
        <h3 className="mr-auto truncate text-sm font-bold">✂ {title}</h3>
        <button onClick={cancel} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">Cancel</button>
        <button onClick={save} disabled={saving || !canvas} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
          {saving ? "Saving…" : "💾 Save cropped picture"}
        </button>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-800 bg-slate-900/80 px-3 py-2">
        {RATIOS.map((r) => (
          <button
            key={r.label}
            onClick={() => chooseRatio(r.value)}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold ${ratio === r.value ? "border-violet-400 bg-violet-600 text-white" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}
          >{r.label}</button>
        ))}
        <span className="mx-1 h-6 w-px shrink-0 bg-slate-700" />
        <button onClick={rotate} className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">↻ Rotate</button>
        <button onClick={() => { setRect({ x: 0, y: 0, w: 1, h: 1 }); setRatio(null); setDirty(true); }} className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">Whole picture</button>
        {canvas && <span className="ml-auto shrink-0 pl-3 text-[11px] text-slate-400">{pxW} × {pxH} px</span>}
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
        {error ? (
          <div className="max-w-sm rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : !canvas || !shownUrl ? (
          <div className="text-sm text-slate-400">Loading picture…</div>
        ) : (
          <div
            ref={boxRef}
            className="relative select-none touch-none"
            style={{ aspectRatio: `${aspect}`, width: `min(100%, max(16rem, calc((100vh - 11rem) * ${aspect})))` }}
            onPointerMove={move}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
          >
            <img src={shownUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
            {/* everything outside the frame is dimmed */}
            <div className="pointer-events-none absolute inset-0 bg-black/55" style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${pct(rect.x)} ${pct(rect.y)}, ${pct(rect.x)} ${pct(rect.y + rect.h)}, ${pct(rect.x + rect.w)} ${pct(rect.y + rect.h)}, ${pct(rect.x + rect.w)} ${pct(rect.y)}, ${pct(rect.x)} ${pct(rect.y)})` }} />
            <div
              className="absolute cursor-move border-2 border-white/90"
              style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
              onPointerDown={(e) => begin(e, "move")}
            >
              {/* thirds grid */}
              <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(to right, transparent 33.2%, rgba(255,255,255,.35) 33.3%, transparent 33.5%, transparent 66.4%, rgba(255,255,255,.35) 66.5%, transparent 66.7%), linear-gradient(to bottom, transparent 33.2%, rgba(255,255,255,.35) 33.3%, transparent 33.5%, transparent 66.4%, rgba(255,255,255,.35) 66.5%, transparent 66.7%)" }} />
              {ratio === null && (
                <>
                  <div className={`${edge} left-0 right-0 top-0 h-3 -translate-y-1/2 cursor-ns-resize`} onPointerDown={(e) => begin(e, "n")} />
                  <div className={`${edge} bottom-0 left-0 right-0 h-3 translate-y-1/2 cursor-ns-resize`} onPointerDown={(e) => begin(e, "s")} />
                  <div className={`${edge} bottom-0 left-0 top-0 w-3 -translate-x-1/2 cursor-ew-resize`} onPointerDown={(e) => begin(e, "w")} />
                  <div className={`${edge} bottom-0 right-0 top-0 w-3 translate-x-1/2 cursor-ew-resize`} onPointerDown={(e) => begin(e, "e")} />
                </>
              )}
              <span className={`${dot} left-0 top-0 cursor-nwse-resize`} onPointerDown={(e) => begin(e, "nw")} />
              <span className={`${dot} left-full top-0 cursor-nesw-resize`} onPointerDown={(e) => begin(e, "ne")} />
              <span className={`${dot} left-0 top-full cursor-nesw-resize`} onPointerDown={(e) => begin(e, "sw")} />
              <span className={`${dot} left-full top-full cursor-nwse-resize`} onPointerDown={(e) => begin(e, "se")} />
            </div>
          </div>
        )}
      </div>
      <p className="border-t border-slate-800 bg-slate-900 px-3 py-2 text-center text-[11px] text-slate-400">Drag the frame to move it, drag the round corners to resize. Your original picture is not changed.</p>
    </div>
  );
}
