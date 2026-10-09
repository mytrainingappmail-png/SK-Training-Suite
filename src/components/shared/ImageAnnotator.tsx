// "Draw on a picture": arrows, lines, circles, rectangles, curly brackets, highlights and text labels placed on top of
// an uploaded picture (a master plan, a floor plan, a site photo). Everything drawn stays an editable object —
// the caller keeps the ORIGINAL picture and the list of drawn objects, so a saved picture can be reopened later and
// any arrow/label moved, recoloured, edited or deleted. Saving flattens the drawing onto the picture as a PNG for display.
// Pure SVG + canvas, no new dependency. Coordinates are stored in "picture-width units" (x / width, y / width), so the
// drawing stays exactly in place at any size.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AnnotationType = "arrow" | "line" | "ellipse" | "rect" | "bracket" | "highlight" | "text";

export interface Annotation {
  id: string;
  type: AnnotationType;
  color: string;
  /** stroke width, in picture-width units */
  sw: number;
  /** soft fill for rect / ellipse */
  fill?: boolean;
  dash?: boolean;
  x1: number; y1: number; x2: number; y2: number;
  text?: string;
  /** font size, in picture-width units */
  fs?: number;
  bold?: boolean;
  /** text sits on a coloured label */
  label?: boolean;
  /** bracket bulges to the other side */
  flip?: boolean;
}

const COLORS = ["#DC2626", "#F59E0B", "#16A34A", "#2563EB", "#7C3AED", "#EC4899", "#0F172A", "#FFFFFF"];
const STROKES = [{ label: "Thin", v: 0.0035 }, { label: "Medium", v: 0.006 }, { label: "Thick", v: 0.01 }];
const TOOLS: { id: AnnotationType | "select"; icon: string; label: string }[] = [
  { id: "select", icon: "☝️", label: "Select / move" },
  { id: "arrow", icon: "➜", label: "Arrow" },
  { id: "line", icon: "╱", label: "Line" },
  { id: "ellipse", icon: "◯", label: "Circle" },
  { id: "rect", icon: "▭", label: "Box" },
  { id: "bracket", icon: "{ }", label: "Bracket" },
  { id: "highlight", icon: "▮", label: "Highlight" },
  { id: "text", icon: "T", label: "Text" },
];
const FONT = "Arial, Helvetica, sans-serif";

let idCounter = 0;
const newId = () => `a${Date.now().toString(36)}${(idCounter++).toString(36)}`;

function fmt(n: number): string {
  return n.toFixed(5);
}

function arrowHead(a: Annotation): string {
  const dx = a.x2 - a.x1, dy = a.y2 - a.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const size = Math.min(len * 0.6, a.sw * 4.5 + 0.012);
  const bx = a.x2 - ux * size, by = a.y2 - uy * size;
  const px = -uy * size * 0.45, py = ux * size * 0.45;
  return `M ${fmt(a.x2)} ${fmt(a.y2)} L ${fmt(bx + px)} ${fmt(by + py)} L ${fmt(bx - px)} ${fmt(by - py)} Z`;
}

/** A curly brace from (x1,y1) to (x2,y2), bulging to one side. */
function bracketPath(a: Annotation): string {
  const dx = a.x2 - a.x1, dy = a.y2 - a.y1;
  const L = Math.hypot(dx, dy) || 0.0001;
  const ux = dx / L, uy = dy / L;
  const side = a.flip ? 1 : -1;
  const nx = -uy * side, ny = ux * side;
  const h = Math.min(L * 0.18, 0.05);
  const P = (t: number, s: number) => `${fmt(a.x1 + ux * t + nx * s)} ${fmt(a.y1 + uy * t + ny * s)}`;
  return `M ${P(0, 0)} Q ${P(0, h / 2)} ${P(L / 4, h / 2)} Q ${P(L / 2, h / 2)} ${P(L / 2, h)} Q ${P(L / 2, h / 2)} ${P((3 * L) / 4, h / 2)} Q ${P(L, h / 2)} ${P(L, 0)}`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** One annotation as SVG markup (used for both the live editor and the flattened export). */
function shapeMarkup(a: Annotation, selected = false): string {
  const stroke = `stroke="${a.color}" stroke-width="${a.sw}" stroke-linecap="round" stroke-linejoin="round"${a.dash ? ` stroke-dasharray="${a.sw * 3} ${a.sw * 2.4}"` : ""}`;
  const minX = Math.min(a.x1, a.x2), minY = Math.min(a.y1, a.y2), w = Math.abs(a.x2 - a.x1), h = Math.abs(a.y2 - a.y1);
  let out = "";
  switch (a.type) {
    case "line":
      out = `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" ${stroke} fill="none"/>`;
      break;
    case "arrow": {
      // stop the shaft at the arrow head so a thick line does not poke out of the tip
      const dx = a.x2 - a.x1, dy = a.y2 - a.y1, len = Math.hypot(dx, dy) || 1;
      const size = Math.min(len * 0.6, a.sw * 4.5 + 0.012);
      const ex = a.x2 - (dx / len) * size * 0.8, ey = a.y2 - (dy / len) * size * 0.8;
      out = `<line x1="${a.x1}" y1="${a.y1}" x2="${ex}" y2="${ey}" ${stroke} fill="none"/><path d="${arrowHead(a)}" fill="${a.color}" stroke="${a.color}" stroke-width="${a.sw * 0.4}" stroke-linejoin="round"/>`;
      break;
    }
    case "ellipse":
      out = `<ellipse cx="${minX + w / 2}" cy="${minY + h / 2}" rx="${w / 2}" ry="${h / 2}" ${stroke} fill="${a.fill ? a.color : "none"}" fill-opacity="${a.fill ? 0.22 : 0}"/>`;
      break;
    case "rect":
      out = `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" ${stroke} fill="${a.fill ? a.color : "none"}" fill-opacity="${a.fill ? 0.22 : 0}"/>`;
      break;
    case "highlight":
      out = `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="${a.color}" fill-opacity="0.35"/>`;
      break;
    case "bracket":
      out = `<path d="${bracketPath(a)}" ${stroke} fill="none"/>`;
      break;
    case "text": {
      const fs = a.fs ?? 0.03;
      const lines = (a.text ?? "").split("\n");
      const pad = fs * 0.3;
      const widest = Math.max(...lines.map((l) => l.length), 1) * fs * 0.58;
      if (a.label) {
        out += `<rect x="${a.x1 - pad}" y="${a.y1 - fs - pad * 0.3}" width="${widest + pad * 2}" height="${lines.length * fs * 1.2 + pad}" rx="${fs * 0.25}" fill="${a.color}"/>`;
      }
      const textColor = a.label ? (a.color === "#FFFFFF" || a.color === "#F59E0B" ? "#0F172A" : "#FFFFFF") : a.color;
      out += `<text x="${a.x1}" y="${a.y1}" font-family="${FONT}" font-size="${fs}" font-weight="${a.bold ? 700 : 500}" fill="${textColor}"${a.label ? "" : ` stroke="${a.color === "#FFFFFF" ? "#0F172A" : "#FFFFFF"}" stroke-width="${fs * 0.07}" paint-order="stroke"`}>${lines
        .map((l, i) => `<tspan x="${a.x1}" dy="${i === 0 ? 0 : fs * 1.2}">${escapeXml(l) || "&#160;"}</tspan>`)
        .join("")}</text>`;
      break;
    }
  }
  return selected ? `<g>${out}</g>` : out;
}

function bounds(a: Annotation): { x: number; y: number; w: number; h: number } {
  if (a.type === "text") {
    const fs = a.fs ?? 0.03;
    const lines = (a.text ?? "").split("\n");
    const widest = Math.max(...lines.map((l) => l.length), 1) * fs * 0.58;
    return { x: a.x1 - fs * 0.3, y: a.y1 - fs * 1.05, w: widest + fs * 0.6, h: lines.length * fs * 1.2 + fs * 0.3 };
  }
  const pad = a.sw;
  return { x: Math.min(a.x1, a.x2) - pad, y: Math.min(a.y1, a.y2) - pad, w: Math.abs(a.x2 - a.x1) + pad * 2, h: Math.abs(a.y2 - a.y1) + pad * 2 };
}

async function fetchAsObjectUrl(src: string): Promise<string> {
  if (src.startsWith("blob:") || src.startsWith("data:")) return src;
  const res = await fetch(src, { mode: "cors" });
  if (!res.ok) throw new Error("The picture could not be loaded.");
  return URL.createObjectURL(await res.blob());
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The picture could not be opened."));
    img.src = url;
  });
}

/** Flattens the picture + drawings into one PNG (max 2000px wide). */
async function exportPng(img: HTMLImageElement, annotations: Annotation[]): Promise<Blob> {
  const scale = Math.min(1, 2000 / img.naturalWidth);
  const W = Math.round(img.naturalWidth * scale), H = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the picture.");
  ctx.drawImage(img, 0, 0, W, H);
  const aspect = img.naturalHeight / img.naturalWidth;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 1 ${aspect}">${annotations.map((a) => shapeMarkup(a)).join("")}</svg>`;
  const svgImg = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  ctx.drawImage(svgImg, 0, 0, W, H);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not save the picture."))), "image/png"));
}

interface Props {
  /** The ORIGINAL picture (never modified). */
  src: string;
  /** Previously drawn objects, to continue editing. */
  initial?: Annotation[];
  title?: string;
  onCancel: () => void;
  /** Gets the flattened PNG and the drawn objects. */
  onSave: (result: { file: File; annotations: Annotation[] }) => void | Promise<void>;
}

export default function ImageAnnotator({ src, initial = [], title = "Draw on picture", onCancel, onSave }: Props) {
  const [objUrl, setObjUrl] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [items, setItems] = useState<Annotation[]>(initial);
  const [past, setPast] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);
  const [tool, setTool] = useState<AnnotationType | "select">("arrow");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [sw, setSw] = useState(STROKES[1].v);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ mode: "draw" | "move" | "handle"; id: string; startX: number; startY: number; orig: Annotation; handle?: string } | null>(null);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; });

  useEffect(() => {
    let revoked = false;
    let url: string | null = null;
    fetchAsObjectUrl(src)
      .then(async (u) => { url = u; const i = await loadImage(u); if (!revoked) { setObjUrl(u); setImg(i); } })
      .catch((e) => !revoked && setLoadError(e instanceof Error ? e.message : "The picture could not be loaded."));
    return () => { revoked = true; if (url && url.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [src]);

  const aspect = img ? img.naturalHeight / img.naturalWidth : 0.6;
  const selected = items.find((a) => a.id === selectedId) ?? null;

  /** Commit a change to the undo history. */
  const commit = useCallback((next: Annotation[]) => {
    setPast((p) => [...p.slice(-60), itemsRef.current]);
    setFuture([]);
    setItems(next);
    setDirty(true);
  }, []);

  function undo() {
    setPast((p) => {
      if (p.length === 0) return p;
      setFuture((f) => [itemsRef.current, ...f]);
      setItems(p[p.length - 1]);
      setDirty(true);
      return p.slice(0, -1);
    });
  }
  function redo() {
    setFuture((f) => {
      if (f.length === 0) return f;
      setPast((p) => [...p, itemsRef.current]);
      setItems(f[0]);
      setDirty(true);
      return f.slice(1);
    });
  }

  function update(id: string, patch: Partial<Annotation>) {
    commit(items.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function remove(id: string) {
    commit(items.filter((a) => a.id !== id));
    setSelectedId(null);
  }
  function duplicate(id: string) {
    const a = items.find((x) => x.id === id);
    if (!a) return;
    const copy = { ...a, id: newId(), x1: a.x1 + 0.02, y1: a.y1 + 0.02, x2: a.x2 + 0.02, y2: a.y2 + 0.02 };
    commit([...items, copy]);
    setSelectedId(copy.id);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = (e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT";
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (typing) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) { e.preventDefault(); remove(selectedId); }
      if (e.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, items]);

  function point(e: React.PointerEvent): { x: number; y: number } {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: ((e.clientY - r.top) / r.height) * aspect };
  }

  function startDraw(e: React.PointerEvent<SVGSVGElement>) {
    if (tool === "select") { setSelectedId(null); return; }
    const p = point(e);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (tool === "text") {
      const a: Annotation = { id: newId(), type: "text", color, sw, x1: p.x, y1: p.y, x2: p.x, y2: p.y, text: "Text", fs: 0.032, bold: true, label: false };
      commit([...items, a]);
      setSelectedId(a.id);
      setTool("select");
      return;
    }
    const a: Annotation = { id: newId(), type: tool, color, sw, x1: p.x, y1: p.y, x2: p.x, y2: p.y, fill: false };
    setItems((cur) => [...cur, a]);
    setSelectedId(a.id);
    drag.current = { mode: "draw", id: a.id, startX: p.x, startY: p.y, orig: a };
  }

  function startMove(e: React.PointerEvent, a: Annotation) {
    if (tool !== "select") return;
    e.stopPropagation();
    (svgRef.current as Element).setPointerCapture(e.pointerId);
    const p = point(e);
    setSelectedId(a.id);
    drag.current = { mode: "move", id: a.id, startX: p.x, startY: p.y, orig: a };
  }

  function startHandle(e: React.PointerEvent, a: Annotation, handle: string) {
    e.stopPropagation();
    (svgRef.current as Element).setPointerCapture(e.pointerId);
    const p = point(e);
    drag.current = { mode: "handle", id: a.id, startX: p.x, startY: p.y, orig: a, handle };
  }

  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = point(e);
    setItems((cur) => cur.map((a) => {
      if (a.id !== d.id) return a;
      if (d.mode === "draw") {
        let x2 = p.x, y2 = p.y;
        if (e.shiftKey && (a.type === "line" || a.type === "arrow" || a.type === "bracket")) {
          // hold Shift: snap to horizontal / vertical / 45°
          const dx = p.x - a.x1, dy = p.y - a.y1;
          const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(dx, dy);
          x2 = a.x1 + Math.cos(ang) * len; y2 = a.y1 + Math.sin(ang) * len;
        }
        return { ...a, x2, y2 };
      }
      const dx = p.x - d.startX, dy = p.y - d.startY;
      if (d.mode === "move") return { ...a, x1: d.orig.x1 + dx, y1: d.orig.y1 + dy, x2: d.orig.x2 + dx, y2: d.orig.y2 + dy };
      // handle: move one end (arrow/line/bracket) or one corner (box shapes)
      const o = d.orig;
      if (d.handle === "p1") return { ...a, x1: o.x1 + dx, y1: o.y1 + dy };
      if (d.handle === "p2") return { ...a, x2: o.x2 + dx, y2: o.y2 + dy };
      const minX = Math.min(o.x1, o.x2), maxX = Math.max(o.x1, o.x2), minY = Math.min(o.y1, o.y2), maxY = Math.max(o.y1, o.y2);
      const left = d.handle!.includes("l") ? minX + dx : minX, right = d.handle!.includes("r") ? maxX + dx : maxX;
      const top = d.handle!.includes("t") ? minY + dy : minY, bottom = d.handle!.includes("b") ? maxY + dy : maxY;
      return { ...a, x1: left, x2: right, y1: top, y2: bottom };
    }));
  }

  function endDrag() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const a = itemsRef.current.find((x) => x.id === d.id);
    if (!a) return;
    if (d.mode === "draw") {
      // a click without dragging draws nothing
      if (Math.hypot(a.x2 - a.x1, a.y2 - a.y1) < 0.01) { setItems((cur) => cur.filter((x) => x.id !== d.id)); setSelectedId(null); return; }
      setPast((p) => [...p.slice(-60), itemsRef.current.filter((x) => x.id !== d.id)]);
      setFuture([]);
      setDirty(true);
      setTool("select");
      return;
    }
    // move / handle: the pre-drag state goes to history
    setPast((p) => [...p.slice(-60), itemsRef.current.map((x) => (x.id === d.id ? d.orig : x))]);
    setFuture([]);
    setDirty(true);
  }

  const handles = useMemo(() => {
    if (!selected || selected.type === "text") return [];
    if (selected.type === "line" || selected.type === "arrow" || selected.type === "bracket") {
      return [{ id: "p1", x: selected.x1, y: selected.y1 }, { id: "p2", x: selected.x2, y: selected.y2 }];
    }
    const x0 = Math.min(selected.x1, selected.x2), x1 = Math.max(selected.x1, selected.x2), y0 = Math.min(selected.y1, selected.y2), y1 = Math.max(selected.y1, selected.y2);
    return [{ id: "tl", x: x0, y: y0 }, { id: "tr", x: x1, y: y0 }, { id: "bl", x: x0, y: y1 }, { id: "br", x: x1, y: y1 }];
  }, [selected]);

  async function handleSave() {
    if (!img) return;
    setSaving(true);
    setSaveError("");
    try {
      const blob = await exportPng(img, items);
      await onSave({ file: new File([blob], `annotated-${Date.now()}.png`, { type: "image/png" }), annotations: items });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save the picture. Please try again.");
      setSaving(false);
    }
  }

  function handleCancel() {
    if (dirty && !confirm("Close without saving? Your changes to this picture will be lost.")) return;
    onCancel();
  }

  const hs = 0.012; // handle half-size, in picture-width units
  const isShapeWithStroke = selected && ["arrow", "line", "ellipse", "rect", "bracket"].includes(selected.type);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950 text-slate-100">
      {/* top bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
        <h3 className="mr-auto truncate text-sm font-bold">{title}</h3>
        <button onClick={undo} disabled={past.length === 0} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-30" title="Undo (Ctrl+Z)">↶ Undo</button>
        <button onClick={redo} disabled={future.length === 0} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-30" title="Redo">↷</button>
        <button onClick={handleCancel} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">Cancel</button>
        <button onClick={handleSave} disabled={saving || !img} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
          {saving ? "Saving…" : "💾 Save picture"}
        </button>
      </div>

      {saveError && <div className="border-b border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{saveError}</div>}

      {/* tools */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-800 bg-slate-900/80 px-3 py-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTool(t.id); if (t.id !== "select") setSelectedId(null); }}
            title={t.label}
            className={`flex shrink-0 flex-col items-center rounded-lg border px-3 py-1 text-[10px] font-semibold ${tool === t.id ? "border-violet-400 bg-violet-600 text-white" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
        <span className="mx-1 h-8 w-px shrink-0 bg-slate-700" />
        {COLORS.map((c) => {
          const active = (selected ? selected.color : color) === c;
          return (
            <button
              key={c}
              onClick={() => { setColor(c); if (selected) update(selected.id, { color: c }); }}
              style={{ backgroundColor: c }}
              className={`h-7 w-7 shrink-0 rounded-full border-2 ${active ? "border-violet-400 ring-2 ring-violet-400/50" : "border-slate-600"}`}
              aria-label={`Colour ${c}`}
            />
          );
        })}
        <span className="mx-1 h-8 w-px shrink-0 bg-slate-700" />
        {STROKES.map((s) => {
          const active = Math.abs((selected && selected.type !== "text" ? selected.sw : sw) - s.v) < 0.0001;
          return (
            <button
              key={s.label}
              onClick={() => { setSw(s.v); if (selected && selected.type !== "text") update(selected.id, { sw: s.v }); }}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${active ? "border-violet-400 bg-violet-600/30 text-white" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* canvas */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
        {loadError ? (
          <div className="max-w-sm rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{loadError}</div>
        ) : !img || !objUrl ? (
          <div className="text-sm text-slate-400">Loading picture…</div>
        ) : (
          <div className="relative max-h-full max-w-full" style={{ aspectRatio: `${1 / aspect}`, width: "min(100%, max(18rem, calc((100vh - 15rem) / " + aspect + ")))" }}>
            <img src={objUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
            <svg
              ref={svgRef}
              viewBox={`0 0 1 ${aspect}`}
              className="absolute inset-0 h-full w-full touch-none"
              style={{ cursor: tool === "select" ? "default" : "crosshair" }}
              onPointerDown={startDraw}
              onPointerMove={onMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {items.map((a) => {
                const b = bounds(a);
                return (
                  <g key={a.id} onPointerDown={(e) => startMove(e, a)} style={{ cursor: tool === "select" ? "move" : undefined }}>
                    {/* generous invisible hit area so thin lines are easy to grab */}
                    <rect x={b.x - 0.01} y={b.y - 0.01} width={b.w + 0.02} height={b.h + 0.02} fill="transparent" />
                    <g dangerouslySetInnerHTML={{ __html: shapeMarkup(a) }} />
                  </g>
                );
              })}
              {selected && (
                <g pointerEvents="none">
                  <rect x={bounds(selected).x} y={bounds(selected).y} width={bounds(selected).w} height={bounds(selected).h} fill="none" stroke="#8B5CF6" strokeWidth={0.0025} strokeDasharray="0.008 0.006" />
                </g>
              )}
              {selected && tool === "select" && handles.map((h) => (
                <rect
                  key={h.id}
                  x={h.x - hs} y={h.y - hs} width={hs * 2} height={hs * 2} rx={0.003}
                  fill="#fff" stroke="#8B5CF6" strokeWidth={0.003}
                  style={{ cursor: "pointer" }}
                  onPointerDown={(e) => startHandle(e, selected, h.id)}
                />
              ))}
            </svg>
          </div>
        )}
      </div>

      {/* properties of the selected object */}
      <div className="border-t border-slate-800 bg-slate-900 px-3 py-2.5">
        {selected ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {selected.type === "text" && (
              <>
                <textarea
                  value={selected.text ?? ""}
                  onChange={(e) => update(selected.id, { text: e.target.value })}
                  rows={1}
                  placeholder="Type your label"
                  className="min-w-[10rem] flex-1 resize-none rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-white outline-none focus:border-violet-500"
                />
                <label className="flex items-center gap-1.5">Size
                  <input type="range" min={0.014} max={0.09} step={0.002} value={selected.fs ?? 0.03} onChange={(e) => update(selected.id, { fs: Number(e.target.value) })} className="w-24" />
                </label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={!!selected.bold} onChange={(e) => update(selected.id, { bold: e.target.checked })} /> Bold</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={!!selected.label} onChange={(e) => update(selected.id, { label: e.target.checked })} /> Coloured background</label>
              </>
            )}
            {(selected.type === "ellipse" || selected.type === "rect") && (
              <label className="flex items-center gap-1"><input type="checkbox" checked={!!selected.fill} onChange={(e) => update(selected.id, { fill: e.target.checked })} /> Soft fill</label>
            )}
            {isShapeWithStroke && (
              <label className="flex items-center gap-1"><input type="checkbox" checked={!!selected.dash} onChange={(e) => update(selected.id, { dash: e.target.checked })} /> Dashed</label>
            )}
            {selected.type === "bracket" && (
              <button onClick={() => update(selected.id, { flip: !selected.flip })} className="rounded-lg border border-slate-700 px-2.5 py-1.5 font-semibold hover:bg-slate-800">⇅ Flip side</button>
            )}
            <span className="ml-auto flex gap-1.5">
              <button onClick={() => duplicate(selected.id)} className="rounded-lg border border-slate-700 px-2.5 py-1.5 font-semibold hover:bg-slate-800">⧉ Copy</button>
              <button onClick={() => remove(selected.id)} className="rounded-lg border border-red-900/60 px-2.5 py-1.5 font-semibold text-red-300 hover:bg-red-500/10">🗑 Delete</button>
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>
              {tool === "select"
                ? "Tap a drawing to move, resize or edit it."
                : tool === "text"
                  ? "Tap on the picture where the label should go."
                  : "Drag on the picture to draw. (Hold Shift for straight lines.)"}
            </span>
            {items.length > 0 && (
              <button
                onClick={() => { if (confirm("Remove ALL drawings from this picture?")) { commit([]); setSelectedId(null); } }}
                className="ml-auto rounded-lg border border-slate-700 px-2.5 py-1.5 font-semibold text-slate-300 hover:bg-slate-800"
              >
                Remove all drawings
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
