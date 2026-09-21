// One screen for marking every map question that shares the same image —
// e.g. 16 "tap the landmark" questions on one Gurgaon map. Pick a question
// on the left, mark its area(s) on the map, move to the next; the other
// questions' areas stay visible (faintly) so overlaps are easy to spot.

import { useState } from "react";
import type { HotspotZone } from "../../types/quiz";
import { HotspotZonePanel } from "./hotspotZones";

export interface BulkMarkerItem {
  localId: string;
  label: string;
  zones: HotspotZone[];
}

interface Props {
  imageUrl: string;
  items: BulkMarkerItem[];
  onZonesChange: (localId: string, zones: HotspotZone[]) => void;
  onClose: () => void;
}

export default function HotspotBulkMarker({ imageUrl, items, onZonesChange, onClose }: Props) {
  const [activeId, setActiveId] = useState(items[0]?.localId ?? "");
  const active = items.find((i) => i.localId === activeId) ?? items[0];
  const markedCount = items.filter((i) => i.zones.length > 0).length;
  const ghostZones = items.filter((i) => i.localId !== active?.localId).flatMap((i) => i.zones);

  function goToNextUnmarked() {
    const start = items.findIndex((i) => i.localId === active?.localId);
    for (let step = 1; step <= items.length; step++) {
      const candidate = items[(start + step) % items.length];
      if (candidate.zones.length === 0) {
        setActiveId(candidate.localId);
        return;
      }
    }
  }

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-3">
        <div>
          <h2 className="text-base font-bold text-white">🗺 Mark all map questions</h2>
          <p className="text-xs text-slate-400">{markedCount} of {items.length} marked · changes are kept in the builder — click Save as Draft afterwards.</p>
        </div>
        <button onClick={onClose} className="text-sm font-semibold bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-lg px-4 py-2">Done</button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        <div className="md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-slate-800 overflow-y-auto max-h-48 md:max-h-none p-2 space-y-1">
          {items.map((item) => (
            <button
              key={item.localId}
              onClick={() => setActiveId(item.localId)}
              className={`w-full text-left text-xs rounded-lg px-3 py-2 border flex items-start gap-2 ${
                item.localId === active.localId ? "border-amber-400 bg-amber-400/10 text-white" : "border-slate-800 text-slate-300 hover:bg-slate-900"
              }`}
            >
              <span className={item.zones.length > 0 ? "text-emerald-400" : "text-amber-400"}>{item.zones.length > 0 ? "✓" : "⚠"}</span>
              <span className="flex-1">{item.label || "(no text)"}</span>
              {item.zones.length > 1 && <span className="text-slate-500">{item.zones.length}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0 overflow-auto p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-white">{active.label}</p>
            <button onClick={goToNextUnmarked} className="text-xs font-semibold text-violet-300 border border-violet-500/40 rounded-lg px-3 py-1 hover:bg-violet-500/10">Next unmarked →</button>
          </div>
          <HotspotZonePanel
            key={active.localId}
            imageUrl={imageUrl}
            zones={active.zones}
            onZonesChange={(z) => onZonesChange(active.localId, z)}
            ghostZones={ghostZones}
          />
        </div>
      </div>
    </div>
  );
}
