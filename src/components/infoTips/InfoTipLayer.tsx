// The "i" tips layer. Mounted ONCE at the top of the app.
//
// It never changes any screen's own elements: it only READS the page (button / heading text), and draws its
// little "i" badges in a separate fixed layer on top. So a screen behaves exactly as before — the badges simply
// float next to the controls that have a tip. Platform owner: an "Edit tips" switch adds "+" badges everywhere.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

import { useInfoTipStore, startInfoTips, loadInfoTips, setInfoTipsHidden, setInfoTipEditMode } from "../../services/infoTips/infoTipStore";
import { TIP_CANDIDATE_SELECTOR, TIP_BUTTON_LIKE_SELECTOR, routePattern, labelKey, labelOfElement } from "../../utils/infoTipMatching";
import { INFO_TIP_EVERYWHERE, type InfoTip, type InfoTipInput } from "../../types/infoTip";
import InfoTipEditor from "./InfoTipEditor";

interface Mark {
  key: string;
  label: string;
  tip: InfoTip | null;
  x: number;
  y: number;
  rect: { left: number; top: number; width: number; height: number };
}
interface Group { label: string; tip: InfoTip | null; els: Element[] }

const ICON = 18;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

export default function InfoTipLayer() {
  const location = useLocation();
  const snap = useInfoTipStore();
  const pattern = routePattern(location.pathname);

  const editing = snap.isOwner && snap.editMode;

  // tips that apply to this screen (a tip for this exact screen beats an "everywhere" tip of the same name)
  const tipByKey = useMemo(() => {
    const m = new Map<string, InfoTip>();
    const usable = snap.tips.filter((t) => editing || t.active);
    for (const t of usable) if (t.route === INFO_TIP_EVERYWHERE) m.set(labelKey(t.label), t);
    for (const t of usable) if (t.route === pattern) m.set(labelKey(t.label), t);
    return m;
  }, [snap.tips, pattern, editing]);

  const showing = editing || (!snap.hidden && tipByKey.size > 0);

  const [rawMarks, setMarks] = useState<Mark[]>([]);
  const marks = showing ? rawMarks : [];
  const [open, setOpen] = useState<{ key: string; pinned: boolean; path: string } | null>(null);
  const [outlineKey, setOutlineKey] = useState<string | null>(null);
  const [editor, setEditor] = useState<InfoTipInput | null>(null);
  const closeTimer = useRef(0);
  const sigRef = useRef<string | null>(null);

  // start once, and make sure the tips are loaded (not on the public marketing home page)
  useEffect(() => { startInfoTips(); }, []);
  useEffect(() => {
    if (location.pathname !== "/") void loadInfoTips();
  }, [location.pathname]);

  // find the controls on the screen and place a badge by each one that has a tip
  useEffect(() => {
    sigRef.current = null; // forces the next position() to publish, even an empty list
    if (!showing) return;

    let groups = new Map<string, Group>();
    let raf = 0;
    let scanTimer = 0;
    let disposed = false;

    function position() {
      if (disposed) return;
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const out: Mark[] = [];
      groups.forEach((g, key) => {
        for (const el of g.els) {
          if (!el.isConnected) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue;
          const px = r.left + Math.min(r.width / 2, 24);
          const py = r.top + r.height / 2;
          if (px < 0 || px >= vw || py < 0 || py >= vh) continue;
          // hidden behind a popup / header / clipped by a scroll area? then no badge
          const hit = document.elementFromPoint(px, py);
          if (!hit || !el.contains(hit)) continue;

          let x = r.right;
          let y = r.top;
          if (!el.matches(TIP_BUTTON_LIKE_SELECTOR)) {
            const range = document.createRange();
            range.selectNodeContents(el);
            const rects = range.getClientRects();
            const last = rects[rects.length - 1];
            if (last && last.width > 0) { x = last.right + 11; y = last.top + last.height / 2; }
          }
          out.push({
            key,
            label: g.label,
            tip: g.tip,
            x: Math.round(clamp(x, ICON / 2 + 2, vw - ICON / 2 - 2)),
            y: Math.round(clamp(y, ICON / 2 + 2, vh - ICON / 2 - 2)),
            rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
          });
          break; // one badge per control name: the first one you can see
        }
      });
      // two badges must never sit on top of each other (tight rows on a phone): slide the later one to the right
      for (let i = 1; i < out.length; i++) {
        for (let j = 0; j < i; j++) {
          if (Math.abs(out[i].x - out[j].x) < ICON + 1 && Math.abs(out[i].y - out[j].y) < ICON + 1) {
            out[i] = { ...out[i], x: Math.min(out[j].x + ICON + 2, vw - ICON / 2 - 2) };
          }
        }
      }
      const sig = out.map((m) => `${m.key}|${m.x}|${m.y}|${m.tip?.id ?? "-"}|${m.tip?.active ? 1 : 0}|${m.tip?.body.length ?? 0}`).join(";");
      if (sig !== sigRef.current) {
        sigRef.current = sig;
        setMarks(out);
      }
    }

    function schedulePosition() {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; position(); });
    }

    function scan() {
      if (disposed) return;
      const next = new Map<string, Group>();
      document.querySelectorAll(TIP_CANDIDATE_SELECTOR).forEach((el) => {
        if (el.closest("[data-info-tip-ui]")) return;
        const label = labelOfElement(el);
        if (!label) return;
        const key = labelKey(label);
        const tip = tipByKey.get(key) ?? null;
        if (!tip && !editing) return;
        let g = next.get(key);
        if (!g) { g = { label, tip, els: [] }; next.set(key, g); }
        g.els.push(el);
      });
      groups = next;
      position();
    }

    function scheduleScan() {
      window.clearTimeout(scanTimer);
      scanTimer = window.setTimeout(scan, 120);
    }

    scan();
    const observer = new MutationObserver((records) => {
      // our own badges changing must not trigger another scan
      if (records.every((rec) => rec.target instanceof Element ? !!rec.target.closest("[data-info-tip-ui]") : !!rec.target.parentElement?.closest("[data-info-tip-ui]"))) return;
      scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("scroll", schedulePosition, { capture: true, passive: true });
    window.addEventListener("resize", schedulePosition);
    const interval = window.setInterval(scan, 1500);

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("scroll", schedulePosition, true);
      window.removeEventListener("resize", schedulePosition);
      window.clearInterval(interval);
      window.clearTimeout(scanTimer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [showing, editing, tipByKey]);

  // a popup only shows while its control is on this screen (it closes by itself when the control scrolls away)
  const openMark = open && open.path === location.pathname ? marks.find((m) => m.key === open.key && m.tip) ?? null : null;

  // tap outside / Esc closes a popup that was opened by tapping
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      const t = e.target as Element | null;
      if (open?.pinned && t && !t.closest("[data-info-tip-ui]")) setOpen(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function cancelClose() {
    window.clearTimeout(closeTimer.current);
  }
  function scheduleClose() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setOpen((cur) => (cur && !cur.pinned ? null : cur));
      setOutlineKey(null);
    }, 250);
  }

  function startNewTip(m: Mark) {
    setOpen(null);
    setEditor({ route: pattern, label: m.label, title: "", body: "", active: true });
  }
  function startEditTip(t: InfoTip) {
    setOpen(null);
    setEditor({ id: t.id, route: t.route, label: t.label, title: t.title ?? "", body: t.body, active: t.active });
  }

  if (typeof document === "undefined") return null;

  const hiddenChip = snap.hidden && tipByKey.size > 0 && !editing;

  return createPortal(
    <>
      <div id="info-tip-layer" data-info-tip-ui className="print:hidden" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 30 }}>
        {editing && outlineKey && (() => {
          const m = marks.find((x) => x.key === outlineKey);
          return m ? <div style={{ position: "fixed", left: m.rect.left - 3, top: m.rect.top - 3, width: m.rect.width + 6, height: m.rect.height + 6, border: "2px dashed #f59e0b", borderRadius: 8, pointerEvents: "none" }} /> : null;
        })()}
        {marks.map((m) => {
          const isOpen = open?.key === m.key;
          const inactive = m.tip && !m.tip.active;
          const add = !m.tip;
          return (
            <button
              key={m.key}
              type="button"
              data-info-tip-ui
              aria-label={add ? `Add a tip for ${m.label}` : `About ${m.label}`}
              aria-expanded={add ? undefined : isOpen}
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                cancelClose();
                if (editing) setOutlineKey(m.key);
                if (m.tip) setOpen((cur) => (cur?.key === m.key ? cur : { key: m.key, pinned: false, path: location.pathname }));
              }}
              onPointerLeave={(e) => { if (e.pointerType === "mouse") scheduleClose(); }}
              onFocus={() => { if (m.tip) setOpen((cur) => (cur?.key === m.key ? cur : { key: m.key, pinned: false, path: location.pathname })); }}
              onBlur={() => scheduleClose()}
              onClick={() => {
                if (add) { startNewTip(m); return; }
                setOpen((cur) => (cur?.key === m.key && cur.pinned ? null : { key: m.key, pinned: true, path: location.pathname }));
              }}
              style={{
                position: "fixed",
                left: m.x - ICON / 2,
                top: m.y - ICON / 2,
                width: ICON,
                height: ICON,
                pointerEvents: "auto",
                borderRadius: 9999,
                border: "1.5px solid #fff",
                boxShadow: "0 1px 4px rgba(15,23,42,.45)",
                background: add ? "#f59e0b" : inactive ? "#94a3b8" : "#4f46e5",
                color: add ? "#451a03" : "#fff",
                fontSize: add ? 14 : 12,
                fontWeight: 800,
                fontStyle: add ? "normal" : "italic",
                fontFamily: "Georgia, 'Times New Roman', serif",
                lineHeight: 1,
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: add ? 0.85 : 1,
              }}
            >
              {add ? "+" : "i"}
            </button>
          );
        })}
      </div>

      {openMark?.tip && (
        <TipPopup
          key={openMark.key}
          mark={openMark}
          tip={openMark.tip}
          pinned={!!open?.pinned}
          isOwner={editing}
          onEnter={cancelClose}
          onLeave={scheduleClose}
          onClose={() => setOpen(null)}
          onEdit={() => startEditTip(openMark.tip as InfoTip)}
          onHideTips={() => { setOpen(null); setInfoTipsHidden(true); }}
        />
      )}

      {(snap.isOwner || hiddenChip) && (
        <div data-info-tip-ui className="print:hidden" style={{ position: "fixed", left: 12, bottom: 12, zIndex: 9990, display: "flex", gap: 8, alignItems: "center" }}>
          {snap.isOwner && (
            <button
              type="button"
              onClick={() => setInfoTipEditMode(!editing)}
              title={editing ? "Finish editing tips" : "Edit tips (platform owner only)"}
              className={editing
                ? "rounded-full bg-amber-400 px-4 py-2 text-xs font-bold text-amber-950 shadow-lg ring-2 ring-white hover:bg-amber-300"
                : "flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white opacity-60 shadow-lg ring-2 ring-white hover:opacity-100"}
            >
              {editing ? "✎ Editing tips — tap + to add, i to change · Done" : "✎"}
            </button>
          )}
          {hiddenChip && (
            <button
              type="button"
              onClick={() => setInfoTipsHidden(false)}
              className="rounded-full bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-white shadow-lg ring-1 ring-white/30 hover:bg-slate-700"
            >
              ⓘ Show tips
            </button>
          )}
        </div>
      )}

      {editor && <InfoTipEditor initial={editor} currentRoute={pattern} onClose={() => setEditor(null)} />}
    </>,
    document.body
  );
}

function TipPopup({
  mark, tip, pinned, isOwner, onEnter, onLeave, onClose, onEdit, onHideTips,
}: {
  mark: Mark;
  tip: InfoTip;
  pinned: boolean;
  isOwner: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClose: () => void;
  onEdit: () => void;
  onHideTips: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const left = clamp(mark.x - w / 2, 8, Math.max(8, vw - w - 8));
    let top = mark.y + ICON / 2 + 8;
    if (top + h > vh - 8) top = Math.max(8, mark.y - ICON / 2 - 8 - h);
    setPos({ left, top });
  }, [mark.x, mark.y, tip.body, tip.title]);

  return (
    <div
      ref={ref}
      data-info-tip-ui
      role="tooltip"
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      className="print:hidden"
      style={{
        position: "fixed",
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? "visible" : "hidden",
        width: "min(300px, calc(100vw - 16px))",
        zIndex: 9998,
        borderRadius: 14,
        background: "#0f172a",
        color: "#e2e8f0",
        border: "1px solid #334155",
        boxShadow: "0 12px 32px rgba(2,6,23,.55)",
        padding: "12px 14px",
        fontSize: 13,
        lineHeight: 1.5,
        textAlign: "left",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ flex: "none", width: 18, height: 18, borderRadius: 9999, background: "#4f46e5", color: "#fff", fontSize: 12, fontWeight: 800, fontStyle: "italic", fontFamily: "Georgia, serif", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>i</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {tip.title && <div style={{ fontWeight: 700, color: "#fcd34d", marginBottom: 2 }}>{tip.title}</div>}
          <div style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{tip.body}</div>
          {!tip.active && <div style={{ marginTop: 6, fontSize: 11, color: "#fca5a5" }}>Hidden from everyone except you.</div>}
        </div>
        {pinned && (
          <button type="button" onClick={onClose} aria-label="Close" style={{ flex: "none", background: "transparent", border: 0, color: "#94a3b8", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 2 }}>✕</button>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8, fontSize: 11 }}>
        {isOwner
          ? <button type="button" onClick={onEdit} style={{ background: "transparent", border: 0, color: "#a5b4fc", fontWeight: 700, cursor: "pointer", padding: 0 }}>✎ Edit this tip</button>
          : <button type="button" onClick={onHideTips} style={{ background: "transparent", border: 0, color: "#64748b", cursor: "pointer", padding: 0, textDecoration: "underline" }}>Hide tips</button>}
      </div>
    </div>
  );
}
