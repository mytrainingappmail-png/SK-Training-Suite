// Shared pieces for hotspot ("Click-the-Map") questions: turning a question
// into its list of correct areas, drawing those areas over an image, and the
// interactive panel a trainer uses to mark them (circle, rectangle or a
// freehand polygon — as many as needed). Used by HotspotZoneEditor (one
// question), HotspotBulkMarker (all map questions on one screen), and the
// trainee/host reveal screens (draw-only).

import { useRef, useState } from "react";
import type { HotspotZone } from "../../types/quiz";

const DEFAULT_RADIUS = 6;
const MIN_RADIUS = 2;
const MAX_RADIUS = 20;

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

export type ZoneTone = "correct" | "selected" | "ghost";

const TONE: Record<ZoneTone, { stroke: string; fill: string }> = {
  correct: { stroke: "#34d399", fill: "rgba(52,211,153,0.25)" },
  selected: { stroke: "#fbbf24", fill: "rgba(251,191,36,0.30)" },
  ghost: { stroke: "#94a3b8", fill: "rgba(148,163,184,0.10)" },
};

/** Draws zones over an image — must sit inside a `relative` box that is exactly the image's size. Circle radii use the same "percent units" the scoring uses, so what's drawn is what counts. */
export function ZoneOverlay({ zones, tone = "correct", selectedIndex = null }: { zones: HotspotZone[]; tone?: ZoneTone; selectedIndex?: number | null }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none">
      {zones.map((z, i) => {
        const t = TONE[selectedIndex === i ? "selected" : tone];
        const common = { stroke: t.stroke, fill: t.fill, strokeWidth: 2, vectorEffect: "non-scaling-stroke" as const };
        if (z.shape === "circle") return <ellipse key={i} cx={z.x} cy={z.y} rx={z.r} ry={z.r} {...common} />;
        if (z.shape === "rect") return <rect key={i} x={z.x} y={z.y} width={z.w} height={z.h} {...common} />;
        return <polygon key={i} points={z.points.map((p) => p.join(",")).join(" ")} {...common} />;
      })}
    </svg>
  );
}

const TOOLS: { id: "circle" | "rect" | "poly"; label: string; hint: string }[] = [
  { id: "circle", label: "◯ Circle", hint: "Click the spot" },
  { id: "rect", label: "▭ Rectangle", hint: "Drag across the area" },
  { id: "poly", label: "⬠ Shape", hint: "Click each corner, then Finish" },
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
  const [tool, setTool] = useState<"circle" | "rect" | "poly">("circle");
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [selected, setSelected] = useState<number | null>(null);
  const [polyDraft, setPolyDraft] = useState<[number, number][]>([]);
  const [rectDraft, setRectDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

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
    if (tool === "rect") {
      e.currentTarget.setPointerCapture(e.pointerId);
      setRectDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    }
  }

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!rectDraft) return;
    const p = pointFrom(e);
    if (p) setRectDraft({ ...rectDraft, x1: p.x, y1: p.y });
  }

  function handleUp(e: React.PointerEvent<HTMLDivElement>) {
    const p = pointFrom(e);
    if (!p) return;
    if (tool === "circle") {
      onZonesChange([...zones, { shape: "circle", x: p.x, y: p.y, r: radius }]);
      setSelected(zones.length);
    } else if (tool === "rect" && rectDraft) {
      const x = Math.min(rectDraft.x0, p.x);
      const y = Math.min(rectDraft.y0, p.y);
      const w = Math.abs(p.x - rectDraft.x0);
      const h = Math.abs(p.y - rectDraft.y0);
      setRectDraft(null);
      if (w >= 1 && h >= 1) {
        onZonesChange([...zones, { shape: "rect", x: round1(x), y: round1(y), w: round1(w), h: round1(h) }]);
        setSelected(zones.length);
      }
    } else if (tool === "poly") {
      setPolyDraft((d) => [...d, [p.x, p.y]]);
    }
  }

  function finishPoly() {
    if (polyDraft.length < 3) return;
    onZonesChange([...zones, { shape: "poly", points: polyDraft }]);
    setSelected(zones.length);
    setPolyDraft([]);
  }

  function removeZone(i: number) {
    onZonesChange(zones.filter((_, idx) => idx !== i));
    setSelected(null);
  }

  function changeRadius(next: number) {
    setRadius(next);
    if (selected !== null && zones[selected]?.shape === "circle") {
      onZonesChange(zones.map((z, i) => (i === selected && z.shape === "circle" ? { ...z, r: next } : z)));
    }
  }

  const draftRect = rectDraft
    ? { x: Math.min(rectDraft.x0, rectDraft.x1), y: Math.min(rectDraft.y0, rectDraft.y1), w: Math.abs(rectDraft.x1 - rectDraft.x0), h: Math.abs(rectDraft.y1 - rectDraft.y0) }
    : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTool(t.id); setPolyDraft([]); setRectDraft(null); }}
            title={t.hint}
            className={`text-xs font-semibold rounded-lg px-3 py-1.5 border ${tool === t.id ? "bg-amber-400 text-amber-950 border-amber-400" : "border-slate-700 text-slate-300 hover:text-white"}`}
          >
            {t.label}
          </button>
        ))}
        <span className="text-xs text-slate-500">{TOOLS.find((t) => t.id === tool)?.hint} — add as many correct areas as you like; a tap in any of them counts.</span>
      </div>

      <div
        className="relative inline-block max-w-full rounded-xl overflow-hidden border border-slate-700 select-none"
        style={{ touchAction: "none", cursor: "crosshair" }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
      >
        <img ref={imgRef} src={imageUrl} alt="Hotspot question" draggable={false} className="block max-w-full h-auto" />
        {ghostZones && ghostZones.length > 0 && <ZoneOverlay zones={ghostZones} tone="ghost" />}
        <ZoneOverlay zones={zones} tone="correct" selectedIndex={selected} />
        {(draftRect || polyDraft.length > 0) && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none">
            {draftRect && <rect x={draftRect.x} y={draftRect.y} width={draftRect.w} height={draftRect.h} fill="rgba(251,191,36,0.2)" stroke="#fbbf24" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />}
            {polyDraft.length > 0 && (
              <polyline points={polyDraft.map((p) => p.join(",")).join(" ")} fill="rgba(251,191,36,0.15)" stroke="#fbbf24" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />
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
          <span>Circle size</span>
          <input type="range" min={MIN_RADIUS} max={MAX_RADIUS} value={radius} onChange={(e) => changeRadius(Number(e.target.value))} className="w-28" />
          <span className="font-mono text-slate-300 w-8">{radius}%</span>
        </div>
        {zones.length === 0 ? (
          <span className="text-xs text-amber-300">⚠ No correct area marked yet</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {zones.map((z, i) => (
              <span key={i} className={`inline-flex items-center gap-1 text-[11px] rounded-full border px-2 py-0.5 ${selected === i ? "border-amber-400 text-amber-200 bg-amber-400/10" : "border-slate-700 text-slate-300"}`}>
                <button type="button" onClick={() => setSelected(i)}>{zoneLabel(z, i)}</button>
                <button type="button" onClick={() => removeZone(i)} title="Remove this area" className="text-red-300 hover:text-red-200">✕</button>
              </span>
            ))}
            <button type="button" onClick={() => { onZonesChange([]); setSelected(null); }} className="text-[11px] text-red-300 hover:text-red-200 px-1">Clear all</button>
          </div>
        )}
      </div>
    </div>
  );
}
