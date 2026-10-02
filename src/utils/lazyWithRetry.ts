import { lazy, type ComponentType, type LazyExoticComponent } from "react";

// Wraps React.lazy so a page/tab that is loaded on demand survives a new deploy.
//
// After a deploy, a tab still open in the browser holds the previous build's index.html in memory,
// but opening a screen it has not loaded yet requests a chunk file whose hashed name no longer
// exists ("Failed to fetch dynamically imported module"). This wrapper retries once through a full
// reload (which fetches the new index.html and current chunk names) instead of crashing; a
// sessionStorage flag stops it from looping if the reload itself does not help (a real outage).
export function lazyWithRetry<T extends { default: ComponentType<any> }>(
  factory: () => Promise<T>
): LazyExoticComponent<T["default"]> {
  return lazy(async () => {
    const RELOAD_FLAG = "sk-chunk-reload-attempted";
    try {
      const module = await factory();
      sessionStorage.removeItem(RELOAD_FLAG);
      return module;
    } catch (error) {
      if (!sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
        // Never resolves — the reload navigates away before this matters.
        return new Promise<T>(() => {});
      }
      throw error;
    }
  });
}
