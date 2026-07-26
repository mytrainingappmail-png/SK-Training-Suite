// Swaps the browser-tab favicon at runtime for the Live Quiz module — it
// opens in its own tab (per the module's "separate app" design), so this
// never affects the main LMS tab; reverts to the default on next full load.
export function applyQuizFavicon(url: string | null | undefined): void {
  if (!url) return;
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link) link.href = url;
}
