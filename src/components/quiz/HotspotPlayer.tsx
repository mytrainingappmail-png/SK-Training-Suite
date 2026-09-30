// The trainee-facing side of a "hotspot" question — tap the correct spot
// on an image. Built mobile-first per the actual use case (trainees take
// these on their phone): explicit zoom +/- buttons rather than relying on
// native pinch-zoom, which behaves inconsistently once the Live Quiz PWA
// is installed as a standalone app. Click/tap position is always read from
// the image's live getBoundingClientRect() at the moment of the tap, so it
// stays correct no matter the current zoom/pan — no transform math needed
// to interpret it.
//
// Two usage modes, chosen by whether the caller passes requireConfirm:
//  - Live Quiz (default, requireConfirm unset): a tap submits immediately
//    via onTap, exactly as before — one shot, synced to the live question
//    timer. Untouched by the change below.
//  - Exam (requireConfirm=true): a tap only PLACES A PIN; the trainee must
//    tap "Confirm" to actually lock it in via onConfirmTap. This exists
//    because trainees were getting wrong answers locked in from an
//    accidental brush while scrolling past the map, with no way back.
//    maxTaps/confirmedTaps let one question expect several distinct spots
//    (e.g. 16 numbered landmarks on one map) instead of just one. Once a
//    tap in confirmedTaps carries a `correct` flag (the caller resolved it
//    server-side — this component never sees zone geometry), the dot is
//    colored and, for the tap that just landed, its name/"wrong spot"
//    floats briefly above it.

import { useEffect, useRef, useState } from "react";
import type { HotspotZone } from "../../types/quiz";
import { ZoneOverlay } from "./hotspotZones";

const MIN_ZOOM = 1;
// Raised from 4 — a map with many small, closely-packed correct areas
// (16 landmarks on one Gurgaon plan, say) needs real zoom headroom for an
// accurate tap; 8x plus full pan coverage gets a candidate close enough to
// tell two adjacent circles apart.
const MAX_ZOOM = 8;
const ZOOM_STEP = 1;
// Raised from 6 — a fixed pixel threshold this tight misclassifies a
// genuine tap as a drag on phones with a more sensitive/jittery touch
// sensor (tap never registers), and inconsistently the other way on
// others. 12px is forgiving of normal finger tremor while still catching
// an intentional pan.
const DRAG_THRESHOLD_PX = 12;

const FEEDBACK_TEXT_SIZE: Record<"small" | "medium" | "large", string> = {
  small: "text-[10px]",
  medium: "text-xs",
  large: "text-sm",
};

interface RevealMarker {
  x: number;
  y: number;
  radius?: number;
  correct: boolean;
}

interface Tap {
  x: number;
  y: number;
  /** Known once resolved server-side. Undefined means "not judged" (reveal feedback is off) — rendered as a neutral dot. */
  correct?: boolean;
  label?: string | null;
}

interface Props {
  imageUrl: string;
  disabled: boolean;
  onTap: (xPct: number, yPct: number) => void;
  /** Shown once the tap has been scored — the correct spot, and (if wrong) where the trainee actually tapped. */
  markers?: RevealMarker[];
  /** The correct area(s), drawn once the tap has been scored. */
  zones?: HotspotZone[];
  /** Exam mode: require an explicit "Confirm" tap before a spot locks in, and allow more than one spot per question. */
  requireConfirm?: boolean;
  /** How many distinct spots this question expects. Only meaningful with requireConfirm. Defaults to 1. */
  maxTaps?: number;
  /** Already-locked-in spots (exam mode) — persists across saves/reloads. */
  confirmedTaps?: Tap[];
  /** Called instead of onTap, once the trainee taps Confirm, in exam mode. May resolve asynchronously (the caller judges the tap server-side); the pending pin stays put until confirmedTaps actually grows. */
  onConfirmTap?: (xPct: number, yPct: number) => void | Promise<void>;
  /** How long a resolved tap's name/"wrong spot" label stays visible. 0 = stays until the next tap. Default 3. */
  feedbackSeconds?: number;
  feedbackSize?: "small" | "medium" | "large";
}

export default function HotspotPlayer({
  imageUrl, disabled, onTap, markers, zones,
  requireConfirm = false, maxTaps = 1, confirmedTaps, onConfirmTap,
  feedbackSeconds = 3, feedbackSize = "small",
}: Props) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [blockedFlash, setBlockedFlash] = useState(false);
  const [pending, setPending] = useState<Tap | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const dragState = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);
  const blockedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTapCount = useRef(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const taps = confirmedTaps ?? [];
  const maxed = requireConfirm && taps.length >= maxTaps;
  const effectiveDisabled = disabled || maxed;

  useEffect(() => () => {
    if (blockedTimer.current) clearTimeout(blockedTimer.current);
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);
  // Clears any pending (unconfirmed) pin once the question locks from outside
  // (time ran out, answer got disabled) so a stale pin never lingers.
  useEffect(() => { if (effectiveDisabled) setPending(null); }, [effectiveDisabled]);

  // A new tap landed in confirmedTaps — the pending pin's job is done, and
  // (if it was judged) its name/"wrong spot" gets a brief moment on screen.
  useEffect(() => {
    if (taps.length > prevTapCount.current) {
      setPending(null);
      setConfirming(false);
      const newIdx = taps.length - 1;
      if (taps[newIdx].correct !== undefined) {
        setFlashIndex(newIdx);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        if (feedbackSeconds > 0) flashTimer.current = setTimeout(() => setFlashIndex(null), feedbackSeconds * 1000);
      }
    }
    prevTapCount.current = taps.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taps.length]);

  function flashBlocked() {
    setBlockedFlash(true);
    if (blockedTimer.current) clearTimeout(blockedTimer.current);
    blockedTimer.current = setTimeout(() => setBlockedFlash(false), 1600);
  }

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
    // Panning/zooming to look around stays available even after the answer
    // locks — only a genuine stationary TAP is blocked (checked in
    // handlePointerUp, once we know this gesture wasn't a drag).
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
    if (!drag || drag.moved || !imgRef.current) return; // was a pan, not a tap — never scored, lock or no lock

    if (effectiveDisabled || confirming) {
      if (effectiveDisabled) flashBlocked();
      return;
    }

    // A tap, not a drag — score it. getBoundingClientRect() reflects the
    // image's actual on-screen box right now (post zoom/pan), so this is
    // correct at any zoom level without adjusting for the transform.
    const rect = imgRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    if (xPct < 0 || xPct > 100 || yPct < 0 || yPct > 100) return; // tapped outside the image itself
    const point = { x: Math.round(xPct * 10) / 10, y: Math.round(yPct * 10) / 10 };

    if (requireConfirm) {
      setPending(point); // just place the pin — trainee must tap Confirm to lock it in
    } else {
      onTap(point.x, point.y);
    }
  }

  async function confirmPending() {
    if (!pending || confirming) return;
    setConfirming(true);
    try {
      await (onConfirmTap ?? onTap)(pending.x, pending.y);
    } finally {
      // Success clears `pending` via the confirmedTaps-growth effect above;
      // on failure nothing grew, so unstick the button for a retry.
      setConfirming(false);
    }
  }

  const sizeClass = FEEDBACK_TEXT_SIZE[feedbackSize];

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
          style={{ cursor: zoom > MIN_ZOOM ? "grab" : effectiveDisabled ? "default" : "crosshair" }}
        >
          {/* Image + answer overlays share one wrapper so the correct area and the
              tap marker stay glued to the image itself — through zoom and pan, and
              regardless of the image being letterboxed inside its box. */}
          <div
            className="relative"
            style={{ lineHeight: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: dragState.current ? "none" : "transform 0.15s ease-out" }}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Tap the correct spot"
              draggable={false}
              className="block pointer-events-none"
              style={{ maxWidth: "100%", maxHeight: "50vh" }}
            />
            {zones && zones.length > 0 && <ZoneOverlay zones={zones} tone="correct" />}
            {markers?.map((m, i) => (
              <div
                key={i}
                className={`absolute rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 ${
                  m.correct ? "border-2 border-emerald-400 bg-emerald-400/25" : "border-2 border-red-400 bg-red-400/30"
                }`}
                style={{ left: `${m.x}%`, top: `${m.y}%`, width: 20, height: 20 }}
              />
            ))}
            {requireConfirm && taps.map((t, i) => {
              const known = t.correct !== undefined;
              const dotClass = !known ? "bg-slate-300 border-white" : t.correct ? "bg-emerald-500 border-white" : "bg-red-500 border-white";
              return (
                <div
                  key={i}
                  className={`absolute rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 border-2 ${dotClass}`}
                  style={{ left: `${t.x}%`, top: `${t.y}%`, width: 14, height: 14 }}
                />
              );
            })}
            {requireConfirm && flashIndex !== null && taps[flashIndex] && (
              <div
                className="absolute -translate-x-1/2 pointer-events-none whitespace-nowrap"
                style={{ left: `${taps[flashIndex].x}%`, top: `${taps[flashIndex].y}%`, marginTop: -26 }}
              >
                <div className={`rounded-full px-2 py-0.5 font-semibold shadow-lg ${sizeClass} ${
                  taps[flashIndex].correct ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                }`}>
                  {taps[flashIndex].correct ? (taps[flashIndex].label || "✓ Correct") : "✗ Not a match"}
                </div>
              </div>
            )}
            {requireConfirm && pending && (
              <div
                className="absolute rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 border-2 border-amber-400 bg-amber-400/30 animate-pulse"
                style={{ left: `${pending.x}%`, top: `${pending.y}%`, width: 22, height: 22 }}
              />
            )}
          </div>
        </div>

        {requireConfirm && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-slate-950/85 border border-slate-700 text-slate-200 text-[11px] font-semibold rounded-full px-3 py-1 shadow">
              🎯 {taps.length} / {maxTaps} marked
            </div>
          </div>
        )}

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

        {requireConfirm && pending && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none px-3">
            <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/95 border border-amber-500/50 rounded-full pl-4 pr-2 py-2 shadow-lg">
              <span className="text-xs font-semibold text-amber-200">📍 Tap elsewhere to move, or</span>
              <button
                onClick={() => void confirmPending()}
                disabled={confirming}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-full px-3 py-1.5"
              >
                {confirming ? "Checking…" : "✅ Confirm"}
              </button>
            </div>
          </div>
        )}

        {blockedFlash && (
          <div className="absolute inset-x-0 top-9 flex justify-center pointer-events-none">
            <div className="bg-slate-950/95 border border-amber-500/50 text-amber-200 text-xs font-semibold rounded-full px-4 py-2 shadow-lg">
              {maxed ? `🔒 All ${maxTaps} points already marked` : "🔒 Already answered — no changes allowed"}
            </div>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-slate-500 mt-2">
        {effectiveDisabled
          ? "Answer locked in — you can still zoom/drag to look around."
          : requireConfirm
            ? "Use +/− to zoom, drag to look around, tap a spot then Confirm."
            : "Use +/− to zoom, drag to look around, tap the correct spot."}
      </p>
    </div>
  );
}
