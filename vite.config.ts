import { defineConfig, type Plugin } from 'vite'
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
function dynamicHtmlBranding(): Plugin {
  return {
    name: 'dynamic-html-branding',
    transformIndexHtml(html) {
      const name = process.env.VITE_BRAND_OVERRIDE_NAME?.trim();
      const logo = process.env.VITE_BRAND_OVERRIDE_LOGO_URL?.trim();
      if (!name && !logo) return html;

      let out = html;
      if (name) {
        out = out.replace(/<title>.*?<\/title>/, `<title>${name}</title>`);
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

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dynamicHtmlBranding(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'SK Training Suite',
        short_name: 'SK Training',
        description: 'Enterprise Learning Management Platform',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
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
})