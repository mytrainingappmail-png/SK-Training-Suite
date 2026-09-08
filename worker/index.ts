// Entry point for the sk-training-suite Worker. Everything except one
// thing works exactly as before (static SPA asset serving via the
// `assets` binding, same as when wrangler.jsonc had no `main` at all) --
// the one addition is a canonical-domain redirect for
// www.realtrainer.net -> realtrainer.net, since that can only be done in
// Worker code: both hostnames are bound as Workers Custom Domains, which
// route straight into this fetch handler and bypass the zone's Page
// Rules/Redirect Rules entirely (confirmed live -- a Page Rule for the
// www host had no effect while the Custom Domain binding was active).
//
// The pages.dev/workers.dev fallback host (sk-training-suite.
// mytrainingappmail.workers.dev) is deliberately left NOT redirecting
// here -- it must keep serving the app directly until the realtrainer.net
// custom domain is fully verified, per the migration plan.

export interface Env {
  ASSETS: Fetcher;
}

const WWW_HOST = "www.realtrainer.net";
const CANONICAL_HOST = "realtrainer.net";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === WWW_HOST) {
      url.hostname = CANONICAL_HOST;
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    return env.ASSETS.fetch(request);
  },
};
