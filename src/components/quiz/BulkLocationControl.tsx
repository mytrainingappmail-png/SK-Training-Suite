// "Move the ticked tests to a location": for tests that were made before locations existed (or at the wrong place). One pick, one
// button. Past sessions keep the location their test had when they were run.

import { useState } from "react";
import type { QuizLocation } from "../../types/quiz";

interface Props {
  locations: QuizLocation[];
  busy: boolean;
  /** null = take the tests out of every location ("All locations" only). */
  onApply: (locationId: string | null) => void;
}

export default function BulkLocationControl({ locations, busy, onApply }: Props) {
  const [choice, setChoice] = useState("");
  const active = locations.filter((l) => l.active);
  if (active.length === 0) {
    return <span className="text-[11px] text-slate-500">Add a location in Settings → Locations to move tests there.</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-white outline-none focus:border-violet-500"
      >
        <option value="">📍 Move to location…</option>
        {active.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
        <option value="__none">No location (only under “All locations”)</option>
      </select>
      <button
        type="button"
        disabled={busy || choice === ""}
        onClick={() => onApply(choice === "__none" ? null : choice)}
        className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-300 disabled:opacity-40"
      >
        {busy ? "Moving…" : "Move"}
      </button>
    </div>
  );
}
