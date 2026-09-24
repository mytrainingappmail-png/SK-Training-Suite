// Renders a repeating text watermark over a block of content — used both in the editor
// (live preview, while the operator is writing) and in the employee-facing viewer (the
// actual protection). Pure CSS: the tiled text is a data-URI SVG background-image on a
// pointer-events:none overlay, so it never interferes with reading/scrolling and can't be
// removed by anything short of editing the page's own CSS.

export interface WatermarkConfig {
  enabled: boolean;
  text: string | null;
  orientation: "horizontal" | "vertical" | "diagonal";
  opacity: number; // 3-40, a percentage
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function watermarkBackground(text: string, orientation: WatermarkConfig["orientation"], opacityPct: number): string {
  const angle = orientation === "vertical" ? -90 : orientation === "diagonal" ? -28 : 0;
  const alpha = Math.max(0.03, Math.min(0.4, opacityPct / 100));
  const tileW = 280;
  const tileH = 160;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tileW}" height="${tileH}">` +
    `<text x="${tileW / 2}" y="${tileH / 2}" transform="rotate(${angle} ${tileW / 2} ${tileH / 2})" ` +
    `font-size="18" font-family="Arial, sans-serif" font-weight="600" fill="rgba(15,23,42,${alpha})" ` +
    `text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Absolutely-positioned overlay — the parent must be `position: relative` (or similar) for it to line up. */
export default function ContentWatermark({ config }: { config: WatermarkConfig }) {
  if (!config.enabled) return null;
  const text = (config.text || "").trim() || "CONFIDENTIAL";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10"
      style={{ backgroundImage: watermarkBackground(text, config.orientation, config.opacity), backgroundRepeat: "repeat" }}
    />
  );
}

export const DEFAULT_WATERMARK: WatermarkConfig = { enabled: false, text: "", orientation: "diagonal", opacity: 12 };

/** The 5 db columns every protectable content table (induction_day_sections,
 * real_estate_project_sections, courses) shares — used for both "new item starts with the
 * company default" and "apply this to everything that already exists". */
export interface ContentProtectionPatch {
  watermark_enabled: boolean;
  watermark_text: string | null;
  watermark_orientation: "horizontal" | "vertical" | "diagonal";
  watermark_opacity: number;
  no_copy: boolean;
}

export function protectionPatchFromCompany(company: {
  default_watermark_enabled: boolean;
  default_watermark_text: string | null;
  default_watermark_orientation: "horizontal" | "vertical" | "diagonal";
  default_watermark_opacity: number;
  default_no_copy: boolean;
}): ContentProtectionPatch {
  return {
    watermark_enabled: company.default_watermark_enabled,
    watermark_text: company.default_watermark_text,
    watermark_orientation: company.default_watermark_orientation,
    watermark_opacity: company.default_watermark_opacity,
    no_copy: company.default_no_copy,
  };
}

/** Spreads onto the content wrapper to discourage casual copying: no text selection, no
 * right-click menu, no image drag-save. Not a real DRM — a determined person can still use
 * devtools — but it raises the bar past "select all, copy, paste elsewhere" for everyone else. */
export function noCopyProps(active: boolean): React.HTMLAttributes<HTMLDivElement> {
  if (!active) return {};
  return {
    onContextMenu: (e) => e.preventDefault(),
    onCopy: (e) => e.preventDefault(),
    onDragStart: (e) => e.preventDefault(),
    style: { userSelect: "none", WebkitUserSelect: "none" },
  };
}
