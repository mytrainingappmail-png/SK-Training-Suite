// Client side of the free "Read in Hinglish" button. The heavy lifting (and the remembered translations) live in the
// translate-hinglish edge function; this file only asks it, remembers answers for the session, and keeps the
// employee's English / Hinglish choice so every page they open follows it.

import { useSyncExternalStore } from "react";
import { supabase } from "../../lib/supabase";

const PREF_KEY = "rt_content_lang";
type Lang = "en" | "hinglish";

let lang: Lang = (() => {
  try { return localStorage.getItem(PREF_KEY) === "hinglish" ? "hinglish" : "en"; } catch { return "en"; }
})();
const listeners = new Set<() => void>();

export function setContentLang(next: Lang): void {
  lang = next;
  try { localStorage.setItem(PREF_KEY, next); } catch { /* the choice just won't be remembered */ }
  listeners.forEach((l) => l());
}

export function useContentLang(): Lang {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => lang,
    () => "en" as Lang
  );
}

let availability: Promise<boolean> | null = null;

/** True once the platform owner has switched translation on (the free key is set). Asked once per page load. */
export function isTranslationAvailable(): Promise<boolean> {
  if (!availability) {
    availability = supabase.functions
      .invoke("translate-hinglish", { body: { action: "status" } })
      .then(({ data, error }) => !error && data?.enabled === true)
      .catch(() => false);
  }
  return availability;
}

const memory = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

/** English HTML in, Hinglish HTML out. Throws an Error with a plain-words message on failure. */
export function translateToHinglish(html: string): Promise<string> {
  const hit = memory.get(html);
  if (hit !== undefined) return Promise.resolve(hit);
  const running = inFlight.get(html);
  if (running) return running;

  const p = supabase.functions
    .invoke("translate-hinglish", { body: { action: "translate", html } })
    .then(async ({ data, error }) => {
      if (error) {
        // the function answers with { error } and a status; surface its sentence if we can read it
        let message = "Translation is not available right now.";
        try {
          const body = await (error as { context?: Response }).context?.json();
          if (body?.error) message = body.error;
        } catch { /* keep the generic sentence */ }
        throw new Error(message);
      }
      const out = typeof data?.html === "string" ? data.html : "";
      if (!out) throw new Error("Translation came back empty.");
      memory.set(html, out);
      return out;
    })
    .finally(() => inFlight.delete(html));
  inFlight.set(html, p);
  return p;
}
