// Shared pieces for hotspot ("Click-the-Map") questions: turning a question
// into its list of correct areas, drawing those areas over an image, and the
// interactive panel a trainer uses to mark them (circle, rectangle, a
// click-corner shape or a freehand pen stroke — as many as needed, each its
// own color). Used by HotspotZoneEditor (one question), HotspotBulkMarker
// (all map questions on one screen), and the trainee/host reveal screens
// (draw-only).
//
// Interaction model: pointing at an EXISTING area always selects it (and, if
// you keep dragging, moves it) — the active tool only decides what happens
// when you point at empty space. This is what makes "tap on a circle you
// already placed" select it instead of stamping down a brand new one.

import { useEffect, useRef, useState } from "react";
import type { HotspotZone } from "../../types/quiz";

const DEFAULT_RADIUS = 6;
const MIN_RADIUS = 2;
const MAX_RADIUS = 20;
const HANDLE_GRAB_TOLERANCE = 2.5; // percent-units around a resize handle that still counts as grabbing it
const HISTORY_LIMIT = 30;
const PALETTE = ["#34d399", "#fbbf24", "#60a5fa", "#f472b6", "#f87171", "#a78bfa"];

interface ZoneSource {
  hotspot_zones: HotspotZone[] | null;
  target_x: number | null;
  target_y: number | null;
  target_radius: number | null;
}

/** The areas a question actually uses: the newer multi-shape list, else the single circle older questions were saved with. */
export function effectiveZones(q: ZoneSource): HotspotZone[] {
  if (q.hotspot_zones && q.hotspot_zones.length > 0) return q.hotspot_zones;
  if (q.target_x !== null && q.target_y !== null) {
    return [{ shape: "circle", x: q.target_x, y: q.target_y, r: q.target_radius ?? DEFAULT_RADIUS }];
  }
  return [];
}

/** Keeps the old single-circle columns in step with the zone list, so anything that only knows about target_x/y/radius still gets a sensible value. */
export function legacyFromZones(zones: HotspotZone[]): { target_x: number | null; target_y: number | null; target_radius: number } {
  const first = zones[0];
  if (!first) return { target_x: null, target_y: null, target_radius: DEFAULT_RADIUS };
  if (first.shape === "circle") return { target_x: first.x, target_y: first.y, target_radius: first.r };
  if (first.shape === "rect") {
    return {
      target_x: round1(first.x + first.w / 2),
      target_y: round1(first.y + first.h / 2),
      target_radius: round1(Math.min(MAX_RADIUS, Math.max(first.w, first.h) / 2)),
    };
  }
  const n = first.points.length || 1;
  return {
    target_x: round1(first.points.reduce((s, p) => s + p[0], 0) / n),
    target_y: round1(first.points.reduce((s, p) => s + p[1], 0) / n),
    target_radius: DEFAULT_RADIUS,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Point-in-shape test, all in the same 0-100 percent space the zones are stored in. */
function pointInZone(z: HotspotZone, x: number, y: number): boolean {
  if (z.shape === "circle") {
    const dx = x - z.x, dy = y - z.y;
    return dx * dx + dy * dy <= z.r * z.r;
  }
  if (z.shape === "rect") {
    return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
  }
  // Ray casting — works for any simple polygon, convex or not.
  let inside = false;
  const pts = z.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Topmost (last-drawn) zone containing the point, so overlapping areas pick the one visually on top. */
function hitTestZones(zones: HotspotZone[], x: number, y: number): number | null {
  for (let i = zones.length - 1; i >= 0; i--) {
    if (pointInZone(zones[i], x, y)) return i;
  }
  return null;
}

function translateZone(z: HotspotZone, dx: number, dy: number): HotspotZone {
  if (z.shape === "circle") return { ...z, x: round1(z.x + dx), y: round1(z.y + dy) };
  if (z.shape === "rect") return { ...z, x: round1(z.x + dx), y: round1(z.y + dy) };
  return { ...z, points: z.points.map(([px, py]) => [round1(px + dx), round1(py + dy)] as [number, number]) };
}

export type ZoneTone = "correct" | "selected" | "ghost";

const TONE: Record<ZoneTone, { stroke: string; fill: string }> = {
  correct: { stroke: "#34d399", fill: "rgba(52,211,153,0.25)" },
  selected: { stroke: "#fbbf24", fill: "rgba(251,191,36,0.30)" },
  ghost: { stroke: "#94a3b8", fill: "rgba(148,163,184,0.10)" },
};

/** Draws zones over an image — must sit inside a `relative` box that is exactly the image's size. Circle radii use the same "percent units" the scoring uses, so what's drawn is what counts. A selected circle also gets a small draggable resize handle at its right edge. */
export function ZoneOverlay({ zones, tone = "correct", selectedIndex = null }: { zones: HotspotZone[]; tone?: ZoneTone; selectedIndex?: number | null }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none">
      {zones.map((z, i) => {
        const isSel = selectedIndex === i;
        const own = z.color;
        const stroke = isSel ? TONE.selected.stroke : own ?? TONE[tone].stroke;
        const fill = isSel ? TONE.selected.fill : own ? hexToRgba(own, 0.25) : TONE[tone].fill;
        const common = { stroke, fill, strokeWidth: 2, vectorEffect: "non-scaling-stroke" as const };
        if (z.shape === "circle") {
          return (
            <g key={i}>
              <ellipse cx={z.x} cy={z.y} rx={z.r} ry={z.r} {...common} />
              {isSel && <circle cx={z.x + z.r} cy={z.y} r={1.8} fill="#fff" stroke="#1e293b" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />}
            </g>
          );
        }
        if (z.shape === "rect") return <rect key={i} x={z.x} y={z.y} width={z.w} height={z.h} {...common} />;
        return <polygon key={i} points={z.points.map((p) => p.join(",")).join(" ")} {...common} />;
      })}
    </svg>
  );
}

const TOOLS: { id: "circle" | "rect" | "poly" | "pen"; label: string; hint: string }[] = [
  { id: "circle", label: "◯ Circle", hint: "Click empty space to place one" },
  { id: "rect", label: "▭ Rectangle", hint: "Drag across empty space" },
  { id: "poly", label: "⬠ Shape", hint: "Click each corner, then Finish" },
  { id: "pen", label: "✏ Pen", hint: "Press and drag to draw freehand" },
];

function zoneLabel(z: HotspotZone, i: number): string {
  return `${i + 1}. ${z.shape === "circle" ? "Circle" : z.shape === "rect" ? "Rectangle" : "Shape"}`;
}

interface PanelProps {
  imageUrl: string;
  zones: HotspotZone[];
  onZonesChange: (zones: HotspotZone[]) => void;
  /** Other questions' areas on the same image, drawn faintly for context (bulk marking). */
  ghostZones?: HotspotZone[];
}

/** Tool bar + image canvas + zone list — everything needed to mark the correct area(s) for ONE question. */
export function HotspotZonePanel({ imageUrl, zones, onZonesChange, ghostZones }: PanelProps) {
  const [tool, setTool] = useState<"circle" | "rect" | "poly" | "pen">("circle");
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [nextColor, setNextColor] = useState<string>(PALETTE[0]);
  const [selected, setSelected] = useState<number | null>(null);
  const [polyDraft, setPolyDraft] = useState<[number, number][]>([]);
  const [penDraft, setPenDraft] = useState<[number, number][]>([]);
  const [rectDraft, setRectDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [history, setHistory] = useState<HotspotZone[][]>([]);
  // While actively moving/resizing a shape, the live position lives here —
  // NOT pushed up via onZonesChange on every pointermove — so a drag doesn't
  // re-render the whole question list (possibly dozens of them) on every
  // tick. The parent only hears about it once, when the gesture ends.
  const [liveZones, setLiveZones] = useState<HotspotZone[] | null>(null);
  const displayZones = liveZones ?? zones;
  const imgRef = useRef<HTMLImageElement>(null);
  const moveRef = useRef<{ idx: number; startX: number; startY: number; original: HotspotZone; baseZones: HotspotZone[] } | null>(null);
  const resizeRef = useRef<{ idx: number; cx: number; cy: number; baseZones: HotspotZone[] } | null>(null);
  const sliderBaseRef = useRef<HotspotZone[] | null>(null);

  function pushHistory(prevZones: HotspotZone[]) {
    setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), prevZones]);
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      onZonesChange(h[h.length - 1]);
      setSelected(null);
      return h.slice(0, -1);
    });
  }

  function removeZone(i: number) {
    pushHistory(zones);
    onZonesChange(zones.filter((_, idx) => idx !== i));
    setSelected(null);
  }

  // Delete (selected area) / Ctrl+Z (undo) — ignored while typing elsewhere on the page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selected !== null) {
        e.preventDefault();
        removeZone(selected);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, zones, history]);

  function pointFrom(e: React.PointerEvent): { x: number; y: number } | null {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: round1(Math.min(100, Math.max(0, x))), y: round1(Math.min(100, Math.max(0, y))) };
  }

  function handleDown(e: React.PointerEvent<HTMLDivElement>) {
    const p = pointFrom(e);
    if (!p) return;

    // Mid-polygon — every click adds the next corner, even if it lands
    // inside another zone. Otherwise a corner placed over an existing area
    // would hijack into selecting/moving THAT zone instead.
    if (tool === "poly" && polyDraft.length > 0) return;

    // Grabbing the selected circle's resize handle?
    if (selected !== null) {
      const z = zones[selected];
      if (z.shape === "circle") {
        const hx = z.x + z.r, hy = z.y;
        if (Math.hypot(p.x - hx, p.y - hy) <= HANDLE_GRAB_TOLERANCE) {
          resizeRef.current = { idx: selected, cx: z.x, cy: z.y, baseZones: zones };
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
      }
    }

    // Pointing at an existing area selects it and starts a move-drag —
    // regardless of which draw tool is active. This is what stops a tap on
    // an already-placed circle from stamping down another one.
    const hitIdx = hitTestZones(zones, p.x, p.y);
    if (hitIdx !== null) {
      setSelected(hitIdx);
      moveRef.current = { idx: hitIdx, startX: p.x, startY: p.y, original: zones[hitIdx], baseZones: zones };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    setSelected(null);
    if (tool === "rect") {
      e.currentTarget.setPointerCapture(e.pointerId);
      setRectDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    } else if (tool === "pen") {
      e.currentTarget.setPointerCapture(e.pointerId);
      setPenDraft([[p.x, p.y]]);
    }
    // circle / poly act on pointer-up instead (a plain click, not a drag).
  }

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    const p = pointFrom(e);
    if (!p) return;

    if (resizeRef.current) {
      const { idx, cx, cy, baseZones } = resizeRef.current;
      const r = round1(Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, Math.hypot(p.x - cx, p.y - cy))));
      const z = baseZones[idx];
      if (z.shape === "circle") {
        setLiveZones(baseZones.map((zz, i) => (i === idx ? { ...z, r } : zz)));
        setRadius(r);
      }
      return;
    }
    if (moveRef.current) {
      const { idx, startX, startY, original, baseZones } = moveRef.current;
      const moved = translateZone(original, p.x - startX, p.y - startY);
      setLiveZones(baseZones.map((zz, i) => (i === idx ? moved : zz)));
      return;
    }
    if (rectDraft) { setRectDraft({ ...rectDraft, x1: p.x, y1: p.y }); return; }
    if (tool === "pen" && penDraft.length > 0) {
      const last = penDraft[penDraft.length - 1];
      if (Math.hypot(p.x - last[0], p.y - last[1]) >= 1.2) setPenDraft((d) => [...d, [p.x, p.y]]);
    }
  }

  function handleUp(e: React.PointerEvent<HTMLDivElement>) {
    if (resizeRef.current) {
      pushHistory(resizeRef.current.baseZones);
      if (liveZones) onZonesChange(liveZones);
      setLiveZones(null);
      resizeRef.current = null;
      return;
    }
    if (moveRef.current) {
      pushHistory(moveRef.current.baseZones);
      if (liveZones) onZonesChange(liveZones);
      setLiveZones(null);
      moveRef.current = null;
      return;
    }

    const p = pointFrom(e);
    if (tool === "circle" && p) {
      pushHistory(zones);
      onZonesChange([...zones, { shape: "circle", x: p.x, y: p.y, r: radius, color: nextColor }]);
      setSelected(zones.length);
    } else if (tool === "rect" && rectDraft && p) {
      const x = Math.min(rectDraft.x0, p.x);
      const y = Math.min(rectDraft.y0, p.y);
      const w = Math.abs(p.x - rectDraft.x0);
      const h = Math.abs(p.y - rectDraft.y0);
      setRectDraft(null);
      if (w >= 1 && h >= 1) {
        pushHistory(zones);
        onZonesChange([...zones, { shape: "rect", x: round1(x), y: round1(y), w: round1(w), h: round1(h), color: nextColor }]);
        setSelected(zones.length);
      }
    } else if (tool === "poly" && p) {
      setPolyDraft((d) => [...d, [p.x, p.y]]);
    } else if (tool === "pen") {
      if (penDraft.length >= 3) {
        pushHistory(zones);
        onZonesChange([...zones, { shape: "poly", points: penDraft, color: nextColor }]);
        setSelected(zones.length);
      }
      setPenDraft([]);
    } else {
      setRectDraft(null);
    }
  }

  function finishPoly() {
    if (polyDraft.length < 3) return;
    pushHistory(zones);
    onZonesChange([...zones, { shape: "poly", points: polyDraft, color: nextColor }]);
    setSelected(zones.length);
    setPolyDraft([]);
  }

  function changeRadius(next: number) {
    setRadius(next);
    if (selected !== null && zones[selected]?.shape === "circle") {
      onZonesChange(zones.map((z, i) => (i === selected && z.shape === "circle" ? { ...z, r: next } : z)));
    }
  }

  function setColor(c: string) {
    setNextColor(c);
    if (selected !== null) {
      pushHistory(zones);
      onZonesChange(zones.map((z, i) => (i === selected ? { ...z, color: c } : z)));
    }
  }

  function cancelGesture() {
    resizeRef.current = null;
    moveRef.current = null;
    setLiveZones(null);
    setRectDraft(null);
  }

  const selectedZone = selected !== null ? displayZones[selected] : null;
  const draftRect = rectDraft
    ? { x: Math.min(rectDraft.x0, rectDraft.x1), y: Math.min(rectDraft.y0, rectDraft.y1), w: Math.abs(rectDraft.x1 - rectDraft.x0), h: Math.abs(rectDraft.y1 - rectDraft.y0) }
    : null;
  const activeColor = selectedZone ? selectedZone.color ?? TONE.correct.stroke : nextColor;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTool(t.id); setPolyDraft([]); setPenDraft([]); setRectDraft(null); }}
            title={t.hint}
            className={`text-xs font-semibold rounded-lg px-3 py-1.5 border ${tool === t.id ? "bg-amber-400 text-amber-950 border-amber-400" : "border-slate-700 text-slate-300 hover:text-white"}`}
          >
            {t.label}
          </button>
        ))}
        <span className="w-px self-stretch bg-slate-800" />
        <button
          type="button"
          onClick={() => selected !== null && removeZone(selected)}
          disabled={selected === null}
          title="Delete the selected area (or press Delete)"
          className="text-xs font-semibold rounded-lg px-3 py-1.5 border border-red-900 text-red-300 hover:bg-red-500/10 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          🗑 Delete
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={history.length === 0}
          title="Undo the last change (or press Ctrl+Z)"
          className="text-xs font-semibold rounded-lg px-3 py-1.5 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300"
        >
          ↺ Undo
        </button>
        <span className="text-xs text-slate-500">{TOOLS.find((t) => t.id === tool)?.hint} — click any existing area to select, drag to move it.</span>
      </div>

      <div
        className="relative inline-block max-w-full rounded-xl overflow-hidden border border-slate-700 select-none"
        style={{ touchAction: "none", cursor: "crosshair" }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={cancelGesture}
      >
        <img ref={imgRef} src={imageUrl} alt="Hotspot question" draggable={false} className="block max-w-full h-auto" />
        {ghostZones && ghostZones.length > 0 && <ZoneOverlay zones={ghostZones} tone="ghost" />}
        <ZoneOverlay zones={displayZones} tone="correct" selectedIndex={selected} />
        {(draftRect || polyDraft.length > 0 || penDraft.length > 0) && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none">
            {draftRect && <rect x={draftRect.x} y={draftRect.y} width={draftRect.w} height={draftRect.h} fill="rgba(251,191,36,0.2)" stroke="#fbbf24" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />}
            {polyDraft.length > 0 && (
              <polyline points={polyDraft.map((p) => p.join(",")).join(" ")} fill="rgba(251,191,36,0.15)" stroke="#fbbf24" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />
            )}
            {penDraft.length > 0 && (
              <polyline points={penDraft.map((p) => p.join(",")).join(" ")} fill="rgba(251,191,36,0.15)" stroke="#fbbf24" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            )}
          </svg>
        )}
      </div>

      {tool === "poly" && polyDraft.length > 0 && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={finishPoly} disabled={polyDraft.length < 3} className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg px-3 py-1.5">
            ✔ Finish shape ({polyDraft.length} points)
          </button>
          <button type="button" onClick={() => setPolyDraft((d) => d.slice(0, -1))} className="text-xs text-slate-300 hover:text-white px-2">↩ Undo point</button>
          <button type="button" onClick={() => setPolyDraft([])} className="text-xs text-red-300 hover:text-red-200 px-2">Cancel</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{selectedZone?.shape === "circle" ? "Resize selected circle" : "New circle size"}</span>
          <input
            type="range"
            min={MIN_RADIUS}
            max={MAX_RADIUS}
            value={radius}
            onPointerDown={() => { sliderBaseRef.current = zones; }}
            onChange={(e) => changeRadius(Number(e.target.value))}
            onPointerUp={() => { if (sliderBaseRef.current) { pushHistory(sliderBaseRef.current); sliderBaseRef.current = null; } }}
            className="w-28"
          />
          <span className="font-mono text-slate-300 w-8">{radius}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">{selectedZone ? "Selected area's color" : "Color"}</span>
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              title={selectedZone ? "Recolor the selected area" : "Color for the next area you draw"}
              className="h-6 w-6 rounded-full border-2"
              style={{ backgroundColor: c, borderColor: activeColor === c ? "#fff" : "transparent" }}
            />
          ))}
        </div>
        {displayZones.length === 0 ? (
          <span className="text-xs text-amber-300">⚠ No correct area marked yet</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {displayZones.map((z, i) => (
              <span key={i} className={`inline-flex items-center gap-1 text-[11px] rounded-full border px-2 py-0.5 ${selected === i ? "border-amber-400 text-amber-200 bg-amber-400/10" : "border-slate-700 text-slate-300"}`}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: z.color ?? TONE.correct.stroke }} />
                <button type="button" onClick={() => setSelected(i)}>{zoneLabel(z, i)}</button>
                <button type="button" onClick={() => removeZone(i)} title="Remove this area" className="text-red-300 hover:text-red-200">✕</button>
              </span>
            ))}
            <button type="button" onClick={() => { pushHistory(zones); onZonesChange([]); setSelected(null); }} className="text-[11px] text-red-300 hover:text-red-200 px-1">Clear all</button>
          </div>
        )}
      </div>
    </div>
  );
}
