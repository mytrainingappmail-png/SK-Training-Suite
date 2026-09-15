// Shared brand watermark, used by both Scripts (per-script toggle) and
// Courses (per-course toggle on written lesson content) — the only two
// places in the app that ever show it, and only ever on the platform
// operator's own account. Same visual recipe as the certificate's own SVG
// text watermark (CertificateRenderer.tsx: -30deg rotation, 0.08 opacity,
// 800 weight, slate-800, uppercased), but tiled as a repeating background
// pattern instead of one centered mark — a single mark only shows once
// near the top of a tall, scrollable lesson/script and is invisible
// everywhere else; a repeating pattern (the actual "Word watermark" look)
// stays visible no matter how long the content or how far it's scrolled.

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildWatermarkPattern(text: string): string {
  const label = escapeXml(text.toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220">
    <text x="180" y="120" text-anchor="middle" transform="rotate(-30 180 120)"
      font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="22"
      fill="#1E293B" fill-opacity="0.08" letter-spacing="1">${label}</text>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Render this FIRST inside a `relative` (or otherwise positioned)
 * container that wraps the content to watermark, before the content
 * itself — plain DOM order (no z-index on either side) then paints it
 * underneath. It stretches to that container's full height via
 * `inset: 0`, tiling the mark as many times as needed. */
function BrandWatermarkOverlay({ text }: { text: string }) {
  if (!text.trim()) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: buildWatermarkPattern(text),
        backgroundRepeat: "repeat",
        pointerEvents: "none",
      }}
    />
  );
}

export default BrandWatermarkOverlay;
