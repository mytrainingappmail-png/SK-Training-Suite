// Which location the Live Quiz admin is currently looking at ("📍 Mohali", or all of them), and the list of
// locations to pick from. A small shared store (no provider) so the top bar and every screen stay in step.
// The choice is remembered per browser and per company.

import { useSyncExternalStore } from "react";
import { listLocations } from "../../repositories/quiz/quizLocationRepository";
import type { QuizLocation } from "../../types/quiz";

export interface QuizLocationSnapshot {
  companyId: string | null;
  locations: QuizLocation[];
  loaded: boolean;
  /** null = "All locations" */
  selectedId: string | null;
}

const KEY_PREFIX = "quiz_admin_location_";

function readSaved(companyId: string): string | null {
  try {
    return localStorage.getItem(KEY_PREFIX + companyId) || null;
  } catch {
    return null;
  }
}
function writeSaved(companyId: string, id: string | null): void {
  try {
    if (id) localStorage.setItem(KEY_PREFIX + companyId, id);
    else localStorage.removeItem(KEY_PREFIX + companyId);
  } catch { /* not remembered — fine */ }
}

let snap: QuizLocationSnapshot = { companyId: null, locations: [], loaded: false, selectedId: null };
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;

function set(patch: Partial<QuizLocationSnapshot>): void {
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l());
}

export function useQuizLocation(): QuizLocationSnapshot {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => snap,
    () => snap
  );
}

/** Loads (or reloads) the company's locations. A remembered choice that no longer exists falls back to "All". */
export function loadQuizLocations(companyId: string, force = false): Promise<void> {
  if (inFlight) return inFlight;
  if (!force && snap.loaded && snap.companyId === companyId) return Promise.resolve();
  inFlight = listLocations(companyId)
    .then((locations) => {
      const saved = snap.companyId === companyId ? snap.selectedId : readSaved(companyId);
      const stillThere = saved && locations.some((l) => l.id === saved && l.active) ? saved : null;
      set({ companyId, locations, loaded: true, selectedId: stillThere });
    })
    .catch(() => set({ companyId, loaded: true }))
    .finally(() => { inFlight = null; });
  return inFlight;
}

export function setQuizLocation(id: string | null): void {
  if (snap.companyId) writeSaved(snap.companyId, id);
  set({ selectedId: id });
}

/** Does a quiz / exam / session with this location show in the current view? */
export function matchesQuizLocation(itemLocationId: string | null | undefined, selectedId: string | null): boolean {
  return selectedId === null || (itemLocationId ?? null) === selectedId;
}

export function locationName(locations: QuizLocation[], id: string | null | undefined): string | null {
  if (!id) return null;
  return locations.find((l) => l.id === id)?.name ?? null;
}
