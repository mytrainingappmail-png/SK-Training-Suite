import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// The <title> tag and social-preview (WhatsApp/etc.) meta tags are static
// HTML, baked in at build time — the in-app dynamic branding (which reads
// from the database at runtime) can't touch them, since link-preview
// crawlers never execute JS. This only changes the built index.html when
// the same VITE_BRAND_OVERRIDE_* vars used elsewhere are set (e.g. the
// Realty Smartz demo deployment) — production, with no overrides set,
// builds byte-identical to before.
function dynamicHtmlBranding(env: Record<string, string>): Plugin {
  return {
    name: 'dynamic-html-branding',
    transformIndexHtml(html) {
      const name = env.VITE_BRAND_OVERRIDE_NAME?.trim();
      const logo = env.VITE_BRAND_OVERRIDE_LOGO_URL?.trim();
      if (!name && !logo) return html;

      let out = html;
      if (name) {
        out = out.replace(/<title>.*?<\/title>/, `<title>${name}</title>`);
        // iOS "Add to Home Screen" reads this meta tag ahead of the manifest name — without
        // rewriting it too, an installed icon on iPhone would still say "SK Training".
        out = out.replace(/<meta name="apple-mobile-web-app-title" content=".*?" \/>/, `<meta name="apple-mobile-web-app-title" content="${name}" />`);
        out = out.replace(
          '</head>',
          `    <meta property="og:title" content="${name}" />\n    <meta property="og:description" content="${name} — a full learning management platform for training, assessments, and certification." />\n  </head>`
        );
      }
      if (logo) {
        out = out.replace('</head>', `    <meta property="og:image" content="${logo}" />\n  </head>`);
      }
      return out;
    },
  };
}

// defineConfig's function form is required here so loadEnv can read .env BEFORE the plugins
// array is built — the plain object form only exposes VITE_-prefixed vars to client code via
// import.meta.env, never to this file's own process.env, so the override vars above and the
// manifest name/icons below would silently never apply from a local .env (only from a real
// shell/CI environment variable) without this.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const brandOverrideName = env.VITE_BRAND_OVERRIDE_NAME?.trim();
  const brandOverrideIcon192 = env.VITE_BRAND_OVERRIDE_ICON_192_URL?.trim();
  const brandOverrideIcon512 = env.VITE_BRAND_OVERRIDE_ICON_512_URL?.trim();

  return {
    plugins: [
      react(),
      tailwindcss(),
      dynamicHtmlBranding(env),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
        manifest: {
          name: brandOverrideName || 'RealTrainer',
          short_name: brandOverrideName || 'RealTrainer',
          description: 'Enterprise Learning Management Platform',
          theme_color: '#0F172A',
          background_color: '#0F172A',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: brandOverrideIcon192 || 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: brandOverrideIcon512 || 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: brandOverrideIcon512 || 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
          navigateFallback: '/index.html',
          runtimeCaching: [],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
      }),
    ],
  };
})
