// Entry point for the sk-training-suite Worker. Static SPA asset serving works exactly as before (the `assets` binding).
//
// Two additions:
// 1. A canonical-domain redirect for www.realtrainer.net -> realtrainer.net, since that can only be done in Worker code: both
//    hostnames are bound as Workers Custom Domains, which route straight into this fetch handler and bypass the zone's Page
//    Rules/Redirect Rules entirely (confirmed live -- a Page Rule for the www host had no effect while the Custom Domain
//    binding was active).
//    The pages.dev/workers.dev fallback host (sk-training-suite.mytrainingappmail.workers.dev) is deliberately left NOT
//    redirecting -- it must keep serving the app directly until the realtrainer.net custom domain is fully verified.
// 2. Link previews (WhatsApp, Facebook, LinkedIn ...). Their robots do not run JavaScript, so the logo the app applies in the
//    browser never reaches them - they read the plain HTML and used to find only a baked-in old icon. Every HTML page now gets
//    the platform's own logo (Platform Console -> marketing settings, readable by anyone) as its preview image, looked up
//    here and kept for a few minutes. If the lookup fails the page is served untouched with the bundled /share-logo.png.

export interface Env {
  ASSETS: Fetcher;
  /** Public project URL and public (anon) key - the same two values the app itself ships with. */
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

const WWW_HOST = "www.realtrainer.net";
const CANONICAL_HOST = "realtrainer.net";
const LOGO_LOOKUP_TIMEOUT_MS = 1500;
const LOGO_CACHE_SECONDS = 600;
const FALLBACK_SHARE_IMAGE = "/share-logo.png";

/** The platform's logo address, or null when it is not set or cannot be fetched quickly. */
async function platformLogoUrl(env: Env): Promise<string | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    const init: RequestInit & { cf?: Record<string, unknown> } = {
      headers: { apikey: env.SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(LOGO_LOOKUP_TIMEOUT_MS),
      cf: { cacheTtl: LOGO_CACHE_SECONDS, cacheEverything: true },
    };
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/platform_marketing_settings?select=logo_url&limit=1`, init);
    if (!res.ok) return null;
    const rows = (await res.json()) as { logo_url?: string | null }[];
    const url = rows[0]?.logo_url?.trim();
    return url && /^https:\/\//i.test(url) ? url : null;
  } catch {
    return null;
  }
}

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === WWW_HOST) {
      url.hostname = CANONICAL_HOST;
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    const response = await env.ASSETS.fetch(request);
    if (request.method !== "GET" || !(response.headers.get("content-type") ?? "").includes("text/html")) return response;

    const image = (await platformLogoUrl(env)) ?? `${url.origin}${FALLBACK_SHARE_IMAGE}`;
    const tags = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:image" content="${escapeAttr(image)}" />`,
      `<meta name="twitter:card" content="summary" />`,
      `<meta name="twitter:image" content="${escapeAttr(image)}" />`,
    ].join("\n    ");

    return new HTMLRewriter()
      .on('link[rel="apple-touch-icon"]', { element: (el) => el.setAttribute("href", image) })
      .on("head", { element: (el) => el.append(`\n    ${tags}\n  `, { html: true }) })
      .transform(response);
  },
};
