// The trainee-facing side of a "hotspot" question — tap the correct spot
// on an image. Built mobile-first per the actual use case (trainees take
// these on their phone): explicit zoom +/- buttons rather than relying on
// native pinch-zoom, which behaves inconsistently once the Live Quiz PWA
// is installed as a standalone app. Click/tap position is always read from
// the image's live getBoundingClientRect() at the moment of the tap, so it
// stays correct no matter the current zoom/pan — no transform math needed
// to interpret it.

import { useRef, useState } from "react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;
const DRAG_THRESHOLD_PX = 6;

interface RevealMarker {
  x: number;
  y: number;
  radius?: number;
  correct: boolean;
}

interface Props {
  imageUrl: string;
  disabled: boolean;
  onTap: (xPct: number, yPct: number) => void;
  /** Shown once the tap has been scored — the correct spot, and (if wrong) where the trainee actually tapped. */
  markers?: RevealMarker[];
}

export default function HotspotPlayer({ imageUrl, disabled, onTap, markers }: Props) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  function zoomIn() {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }
  function zoomOut() {
    setZoom((z) => {
      const next = Math.max(MIN_ZOOM, z - ZOOM_STEP);
      if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
      return next;
    });
  }
  function resetView() {
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) drag.moved = true;
    if (zoom > MIN_ZOOM) setPan({ x: drag.panX + dx, y: drag.panY + dy });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    dragState.current = null;
    if (disabled || !drag || drag.moved || !imgRef.current) return;

    // A tap, not a drag — score it. getBoundingClientRect() reflects the
    // image's actual on-screen box right now (post zoom/pan), so this is
    // correct at any zoom level without adjusting for the transform.
    const rect = imgRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    if (xPct < 0 || xPct > 100 || yPct < 0 || yPct > 100) return; // tapped outside the image itself
    onTap(Math.round(xPct * 10) / 10, Math.round(yPct * 10) / 10);
  }

  return (
    <div className="px-4">
      <div
        className="relative w-full rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden touch-none select-none"
        style={{ height: "50vh" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { dragState.current = null; }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ cursor: disabled ? "default" : zoom > MIN_ZOOM ? "grab" : "crosshair" }}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Tap the correct spot"
            draggable={false}
            className="max-w-full max-h-full pointer-events-none"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: dragState.current ? "none" : "transform 0.15s ease-out" }}
          />
          {markers?.map((m, i) => (
            <div
              key={i}
              className={`absolute rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 ${
                m.correct ? "border-2 border-emerald-400 bg-emerald-400/25" : "border-2 border-red-400 bg-red-400/30"
              }`}
              style={
                m.radius
                  ? { left: `${m.x}%`, top: `${m.y}%`, width: `${m.radius * 2}%`, aspectRatio: "1 / 1" }
                  : { left: `${m.x}%`, top: `${m.y}%`, width: 20, height: 20 }
              }
            />
          ))}
        </div>

        <div className="absolute bottom-3 right-3 flex flex-col gap-2">
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="h-11 w-11 rounded-full bg-slate-950/80 border border-slate-700 text-white text-lg font-bold flex items-center justify-center disabled:opacity-30 active:scale-95"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="h-11 w-11 rounded-full bg-slate-950/80 border border-slate-700 text-white text-lg font-bold flex items-center justify-center disabled:opacity-30 active:scale-95"
            aria-label="Zoom out"
          >
            −
          </button>
          {(zoom > MIN_ZOOM || pan.x !== 0 || pan.y !== 0) && (
            <button
              onClick={resetView}
              className="h-11 w-11 rounded-full bg-slate-950/80 border border-slate-700 text-white text-xs font-bold flex items-center justify-center active:scale-95"
              aria-label="Reset zoom"
            >
              ⟲
            </button>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-slate-500 mt-2">
        {disabled ? "Answer locked in." : "Use +/− to zoom, drag to look around, tap the correct spot."}
      </p>
    </div>
  );
}
