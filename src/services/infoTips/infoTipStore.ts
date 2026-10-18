// Shared state for the "i" tips: the tip list, whether the person may edit them (platform owner),
// whether they chose to hide tips, and whether Edit-tips mode is on. Plain module store (no provider) so the
// tips layer can sit at the very top of the app without changing any existing screen.

import { useSyncExternalStore } from "react";
import { supabase } from "../../lib/supabase";
import { fetchInfoTips, checkInfoTipOwner } from "../../repositories/infoTips/infoTipRepository";
import type { InfoTip } from "../../types/infoTip";

export interface InfoTipSnapshot {
  tips: InfoTip[];
  loaded: boolean;
  isOwner: boolean;
  /** Owner only: show "+" badges and let them write tips. */
  editMode: boolean;
  /** Personal choice: tips hidden (each person decides for themselves). */
  hidden: boolean;
}

const HIDDEN_KEY = "rt_info_tips_hidden";
const EDIT_KEY = "rt_info_tips_edit";
const REFRESH_AFTER_MS = 5 * 60 * 1000;

function readFlag(storage: "local" | "session", key: string): boolean {
  try {
    return (storage === "local" ? localStorage : sessionStorage).getItem(key) === "1";
  } catch {
    return false;
  }
}
function writeFlag(storage: "local" | "session", key: string, on: boolean): void {
  try {
    const s = storage === "local" ? localStorage : sessionStorage;
    if (on) s.setItem(key, "1"); else s.removeItem(key);
  } catch { /* not remembered — fine */ }
}

let snap: InfoTipSnapshot = {
  tips: [],
  loaded: false,
  isOwner: false,
  editMode: readFlag("session", EDIT_KEY),
  hidden: readFlag("local", HIDDEN_KEY),
};
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;
let loadedAt = 0;
let started = false;

function set(patch: Partial<InfoTipSnapshot>): void {
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeInfoTips(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export function getInfoTipSnapshot(): InfoTipSnapshot {
  return snap;
}
export function useInfoTipStore(): InfoTipSnapshot {
  return useSyncExternalStore(subscribeInfoTips, getInfoTipSnapshot, getInfoTipSnapshot);
}

/** Loads (or refreshes) the tips. Never throws: if it fails the screens simply show no tips. */
export function loadInfoTips(force = false): Promise<void> {
  if (loading) return loading;
  if (!force && snap.loaded && Date.now() - loadedAt < REFRESH_AFTER_MS) return Promise.resolve();
  loading = fetchInfoTips()
    .then((tips) => { loadedAt = Date.now(); set({ tips, loaded: true }); })
    .catch(() => { loadedAt = Date.now(); set({ loaded: true }); })
    .finally(() => { loading = null; });
  return loading;
}

async function refreshOwner(): Promise<void> {
  const owner = await checkInfoTipOwner().catch(() => false);
  if (owner !== snap.isOwner) {
    set({ isOwner: owner, editMode: owner ? snap.editMode : false });
    // the owner also sees hidden tips, so reload the list when ownership changes
    void loadInfoTips(true);
  }
}

/** Called once when the app starts. */
export function startInfoTips(): void {
  if (started) return;
  started = true;
  void refreshOwner();
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
      // defer: never call back into supabase inside its own auth callback
      setTimeout(() => { void refreshOwner(); }, 0);
    }
  });
}

export function setInfoTipsHidden(hidden: boolean): void {
  writeFlag("local", HIDDEN_KEY, hidden);
  set({ hidden });
}
export function setInfoTipEditMode(on: boolean): void {
  const next = on && snap.isOwner;
  writeFlag("session", EDIT_KEY, next);
  set({ editMode: next });
}
