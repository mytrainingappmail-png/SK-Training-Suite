// Canvas-based certificate rendering — 5 distinct, colorful templates.
// No external fonts/images required, so it always renders identically
// regardless of company branding being configured or not.

import type { CertTemplate, CertLogoPosition, CertSignatureMode, CertSignatureAlign, CertWatermarkType, CertPhotoFrame, CertAwardSeal } from "../../types/quiz";

export interface CertificateData {
  candidateName: string;
  quizTitle: string;
  scoreLine: string;
  certNumber: string;
  issuedDate: string;
  companyName: string;
  companyNameAlign?: CertSignatureAlign | null;
  logoUrl?: string | null;
  logoPosition?: CertLogoPosition | null;
  logoScale?: number | null;
  /** Independent of logoPosition — "logo" fades the same logo image across the page, "text" draws custom diagonal text (Word-style), "none"/undefined draws nothing. Either way this is in addition to, not instead of, the small positioned logo mark. */
  watermarkType?: CertWatermarkType | null;
  /** Only used when watermarkType is "text". */
  watermarkText?: string | null;
  title: string;
  achievementLine: string;
  signatory1Name?: string | null;
  signatory1Title?: string | null;
  signatory1ImageUrl?: string | null;
  signatory1Scale?: number | null;
  signatory1NameScale?: number | null;
  signatory2Name?: string | null;
  signatory2Title?: string | null;
  signatory2ImageUrl?: string | null;
  signatory2Scale?: number | null;
  signatory2NameScale?: number | null;
  /** "both" (default) keeps the original two-slot side-by-side layout; "single" draws only signatory 1, positioned by signatureAlign. */
  signatureMode?: CertSignatureMode | null;
  /** Only used when signatureMode is "single". */
  signatureAlign?: CertSignatureAlign | null;
  /** Reserves the top-right corner for a circular candidate photo — the design's own toggle. */
  photoEnabled?: boolean | null;
  /** Admin-attached after issuance — drawn only when photoEnabled is also true. */
  photoUrl?: string | null;
  /** Crop shape for the photo slot — cosmetic only, defaults to "circle". */
  photoFrame?: CertPhotoFrame | null;
  /** An optional award badge drawn above the signature line — independent of the template's own decorations (e.g. Royal Seal's built-in top medallion is unaffected). */
  awardSeal?: CertAwardSeal | null;
}

const WIDTH = 1200;
const HEIGHT = 850;
// Canvas is rasterized at 3x and downscaled by CSS/PNG export. At 3x, a
// 1200x850 certificate exports at 3600x2550 — comfortably over 300 DPI
// for an A4/Letter-landscape print, not just crisp on screen.
const RENDER_SCALE = 3;

interface Palette {
  background: (ctx: CanvasRenderingContext2D) => void;
  border: string;
  accent: string;
  heading: string;
  body: string;
  muted: string;
  headingFont: string;
  bodyFont: string;
}

function gradientBg(colors: [string, string], angle: "diag" | "vert" = "diag") {
  return (ctx: CanvasRenderingContext2D) => {
    const g = angle === "diag" ? ctx.createLinearGradient(0, 0, WIDTH, HEIGHT) : ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  };
}

const PALETTES: Record<CertTemplate, Palette> = {
  classic_gold: {
    background: (ctx) => {
      ctx.fillStyle = "#FFFBEB";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    },
    border: "#B8860B",
    accent: "#B8860B",
    heading: "#78350F",
    body: "#451A03",
    muted: "#92703A",
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "Georgia, 'Times New Roman', serif",
  },
  royal_blue: {
    background: gradientBg(["#0F2A6B", "#1E3A8A"]),
    border: "#FCD34D",
    accent: "#FCD34D",
    heading: "#FFFFFF",
    body: "#E0E7FF",
    muted: "#93C5FD",
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "Arial, sans-serif",
  },
  modern_purple: {
    background: gradientBg(["#5B21B6", "#DB2777"]),
    border: "#FFFFFF",
    accent: "#FDE68A",
    heading: "#FFFFFF",
    body: "#F5F3FF",
    muted: "#E9D5FF",
    headingFont: "Arial, sans-serif",
    bodyFont: "Arial, sans-serif",
  },
  minimal_white: {
    background: (ctx) => {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    },
    border: "#111827",
    accent: "#111827",
    heading: "#111827",
    body: "#374151",
    muted: "#6B7280",
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "Arial, sans-serif",
  },
  dark_elegant: {
    background: gradientBg(["#0F0F14", "#1F1B2E"], "vert"),
    border: "#F59E0B",
    accent: "#F59E0B",
    heading: "#F5F5F4",
    body: "#D6D3D1",
    muted: "#A8A29E",
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "Arial, sans-serif",
  },
  // Deep black-on-black with a metallic gold title and a beveled double
  // frame + corner brackets — the "premium/3D" look, all vector-drawn.
  premium_embossed: {
    background: gradientBg(["#0A0A0C", "#141419"], "vert"),
    border: "#B8860B",
    accent: "#D4AF37",
    heading: "#F5EFDD",
    body: "#C9C2AE",
    muted: "#8A8370",
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "Arial, sans-serif",
  },
  // Ivory/cream formal look built around a procedurally-drawn wax-seal
  // medallion instead of an uploaded logo image.
  royal_seal: {
    background: (ctx) => {
      ctx.fillStyle = "#FBF7ED";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    },
    border: "#8B1E2E",
    accent: "#8B1E2E",
    heading: "#1E293B",
    body: "#44403C",
    muted: "#78716C",
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "Georgia, 'Times New Roman', serif",
  },
};

/** Resolves to null (rather than rejecting) on a broken/unreachable URL, so one bad signature image doesn't stop the whole certificate from rendering. */
function loadImage(url: string | null | undefined): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Crops away transparent padding around a signature scan, keeping only
 * the actual ink (+ a small margin) — exported signature images almost
 * always have generous whitespace around the strokes, which otherwise
 * makes the signature look tiny/far from the line no matter how the box
 * is sized, and makes the size slider barely change anything visible
 * (most of what it's resizing is invisible padding). Falls back to the
 * untrimmed image if pixels can't be read (e.g. a CORS-blocked URL) or
 * the image turns out to be fully transparent. */
function trimTransparentEdges(image: HTMLImageElement): HTMLImageElement | HTMLCanvasElement {
  const full = document.createElement("canvas");
  full.width = image.width;
  full.height = image.height;
  const fullCtx = full.getContext("2d");
  if (!fullCtx) return image;
  fullCtx.drawImage(image, 0, 0);

  let data: Uint8ClampedArray;
  try {
    data = fullCtx.getImageData(0, 0, full.width, full.height).data;
  } catch {
    return image;
  }

  const ALPHA_THRESHOLD = 10;
  let minX = full.width, minY = full.height, maxX = 0, maxY = 0;
  for (let y = 0; y < full.height; y++) {
    for (let x = 0; x < full.width; x++) {
      if (data[(y * full.width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return image;

  const pad = 6;
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(full.width, maxX + pad);
  const y1 = Math.min(full.height, maxY + pad);

  const trimmed = document.createElement("canvas");
  trimmed.width = x1 - x0;
  trimmed.height = y1 - y0;
  const tctx = trimmed.getContext("2d");
  if (!tctx) return image;
  tctx.drawImage(full, x0, y0, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  return trimmed;
}

/** Recolors every non-transparent pixel of an image to a solid color while keeping its original alpha/shape — turns a scanned signature (almost always dark ink) into whatever color the certificate template needs it to be, instead of assuming it's always light-on-dark or dark-on-light. */
function tintImage(image: HTMLImageElement | HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = image.width;
  c.height = image.height;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.drawImage(image, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Fills text with a horizontal light→dark→light gold gradient instead of
 * a flat color — reads as a metallic/embossed title rather than flat print. */
function drawMetallicText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, halfWidth = 320): void {
  ctx.font = font;
  const g = ctx.createLinearGradient(x - halfWidth, 0, x + halfWidth, 0);
  g.addColorStop(0, "#8A6A1F");
  g.addColorStop(0.35, "#F5D580");
  g.addColorStop(0.5, "#FFF6D9");
  g.addColorStop(0.65, "#F5D580");
  g.addColorStop(1, "#8A6A1F");
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
}

/** A beveled double-frame with small corner brackets, in place of the
 * plain two-rect border — the light/dark rule pair either side of the
 * mid line is what reads as "embossed" rather than flat. */
function drawEmbossedFrame(ctx: CanvasRenderingContext2D, accent: string): void {
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 8;
  ctx.strokeRect(28, 28, WIDTH - 56, HEIGHT - 56);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(34, 34, WIDTH - 68, HEIGHT - 68);
  ctx.strokeStyle = "#3A2E0F";
  ctx.lineWidth = 1;
  ctx.strokeRect(46, 46, WIDTH - 92, HEIGHT - 92);

  const corners: [number, number, number, number][] = [
    [60, 60, 1, 1],
    [WIDTH - 60, 60, -1, 1],
    [60, HEIGHT - 60, 1, -1],
    [WIDTH - 60, HEIGHT - 60, -1, -1],
  ];
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  corners.forEach(([cx, cy, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * 26);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * 26, cy);
    ctx.stroke();
  });
}

/** A procedurally-drawn wax-seal/medallion — a scalloped ring, an inner
 * ring, and a 5-point star — no image asset, built entirely from arcs
 * and a path so it scales cleanly at any resolution. */
function drawSeal(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const scallops = 18;
  for (let i = 0; i <= scallops; i++) {
    const a = (i / scallops) * Math.PI * 2;
    const rr = r + (i % 2 === 0 ? 6 : 0);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#FFFFFF44";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 10, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  const spikes = 5;
  const outerR = r * 0.5;
  const innerR = r * 0.2;
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Draws a 5-point star centered at cx/cy — shared by the seal medallion and the gold medal below. */
function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A classic gold award medal with two ribbon tails hanging below it — an
 * optional badge independent of the chosen template, drawn above the
 * signature line so it reads as "this is an award" at a glance. */
function drawMedal(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.save();

  // Ribbon tails, drawn first so the medal circle sits on top of them.
  const tailFill = (color: string, dx: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx + dx * r * 0.5, cy + r * 0.15);
    ctx.lineTo(cx + dx * r * 1.05, cy + r * 2.1);
    ctx.lineTo(cx + dx * r * 0.35, cy + r * 1.7);
    ctx.closePath();
    ctx.fill();
  };
  tailFill("#7F1D1D", -1);
  tailFill("#991B1B", 1);

  // Medal disc — radial gold gradient for a slight metallic sheen.
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.15, cx, cy, r);
  g.addColorStop(0, "#FFF6D9");
  g.addColorStop(0.55, "#F0C24B");
  g.addColorStop(1, "#B8860B");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#8A6A1F";
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.beginPath();
  ctx.arc(cx, cy, r - r * 0.08, 0, Math.PI * 2);
  ctx.stroke();

  drawStar(ctx, cx, cy, r * 0.48, r * 0.2, "#FFFFFF");
  ctx.restore();
}

/** Draws the design's chosen award badge (if any) centered at cx/cy — kept
 * separate from any template-specific decoration (e.g. Royal Seal's own
 * top medallion, drawn elsewhere and unaffected by this). */
function drawAwardSeal(ctx: CanvasRenderingContext2D, seal: CertAwardSeal, cx: number, cy: number, accent: string): void {
  if (seal === "medal") drawMedal(ctx, cx, cy, 34);
  else if (seal === "seal") drawSeal(ctx, cx, cy, 34, accent);
}

/** Non-oval frames use a symmetric r for both axes; oval widens it — this
 * keeps the clip path and the "cover" image scaling using the same box. */
function photoFrameExtents(frame: CertPhotoFrame, r: number): { rx: number; ry: number } {
  return frame === "oval" ? { rx: r * 1.25, ry: r * 0.9 } : { rx: r, ry: r };
}

/** Traces (but doesn't fill/stroke) the outline for a given frame shape,
 * centered at cx/cy — shared between the clip used to crop a real photo
 * and the dashed outline drawn when no photo has been attached yet. */
function photoFramePath(ctx: CanvasRenderingContext2D, frame: CertPhotoFrame, cx: number, cy: number, rx: number, ry: number): void {
  ctx.beginPath();
  if (frame === "square") {
    ctx.rect(cx - rx, cy - ry, rx * 2, ry * 2);
  } else if (frame === "rounded_square") {
    const rad = Math.min(rx, ry) * 0.35;
    const x = cx - rx, y = cy - ry, w = rx * 2, h = ry * 2;
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
  } else if (frame === "hexagon") {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const x = cx + rx * Math.cos(a);
      const y = cy + ry * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  } else if (frame === "oval") {
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  } else {
    ctx.arc(cx, cy, rx, 0, Math.PI * 2);
  }
  ctx.closePath();
}

/** A white polaroid-style card with a blank strip below the photo — the
 * one frame that isn't just a clip shape, so it's handled on its own. */
function drawPhotoPolaroid(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, cx: number, cy: number, r: number, placeholderColor: string): void {
  const pad = 8;
  const stripH = 22;
  const photoSize = r * 2;
  const boxW = photoSize + pad * 2;
  const boxH = photoSize + pad * 2 + stripH;
  const x = cx - boxW / 2;
  const y = cy - r - pad;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x, y, boxW, boxH);
  ctx.restore();

  if (image) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + pad, y + pad, photoSize, photoSize);
    ctx.clip();
    const scale = Math.max(photoSize / image.width, photoSize / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, x + pad + photoSize / 2 - w / 2, y + pad + photoSize / 2 - h / 2, w, h);
    ctx.restore();
    ctx.strokeStyle = "#00000022";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + pad, y + pad, photoSize, photoSize);
  } else {
    ctx.save();
    ctx.strokeStyle = placeholderColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x + pad, y + pad, photoSize, photoSize);
    ctx.restore();
  }
}

/** The candidate's own photo, admin-attached after issuance — cropped into
 * whichever frame shape the design picked, with a colored ring, fixed in
 * the top-right corner so it never collides with the logo (top-center by
 * default). Falls back to a matching dashed placeholder when no photo has
 * been attached yet, so the reserved spot is still visible in previews. */
function drawPhoto(ctx: CanvasRenderingContext2D, frame: CertPhotoFrame, image: HTMLImageElement | null, cx: number, cy: number, r: number, ringColor: string, placeholderColor: string): void {
  if (frame === "polaroid") {
    drawPhotoPolaroid(ctx, image, cx, cy, r, placeholderColor);
    return;
  }

  const { rx, ry } = photoFrameExtents(frame, r);

  if (image) {
    ctx.save();
    photoFramePath(ctx, frame, cx, cy, rx, ry);
    ctx.clip();
    const scale = Math.max((rx * 2) / image.width, (ry * 2) / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();

    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 4;
    photoFramePath(ctx, frame, cx, cy, rx, ry);
    ctx.stroke();
  } else {
    ctx.save();
    ctx.strokeStyle = placeholderColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    photoFramePath(ctx, frame, cx, cy, rx, ry);
    ctx.stroke();
    ctx.restore();
  }
}

export async function renderCertificateToCanvas(canvas: HTMLCanvasElement, template: CertTemplate, data: CertificateData): Promise<void> {
  const [sig1ImageRaw, sig2ImageRaw, logoImageRaw, photoImage] = await Promise.all([
    loadImage(data.signatory1ImageUrl),
    loadImage(data.signatory2ImageUrl),
    loadImage(data.logoUrl),
    loadImage(data.photoEnabled ? data.photoUrl : null),
  ]);
  const sig1Image = sig1ImageRaw ? trimTransparentEdges(sig1ImageRaw) : null;
  const sig2Image = sig2ImageRaw ? trimTransparentEdges(sig2ImageRaw) : null;
  // Trimmed the same way as signatures — an uploaded logo PNG almost always
  // has whitespace padding around the mark, which otherwise makes it look
  // smaller and off-center than the bounding box suggests, in both the
  // small positioned mark and the background watermark.
  const logoImage = logoImageRaw ? trimTransparentEdges(logoImageRaw) : null;

  canvas.width = WIDTH * RENDER_SCALE;
  canvas.height = HEIGHT * RENDER_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Every draw call below still uses the original WIDTH/HEIGHT coordinate
  // system — this scale makes them all land on the higher-resolution canvas.
  ctx.scale(RENDER_SCALE, RENDER_SCALE);

  const p = PALETTES[template] ?? PALETTES.dark_elegant;
  const logoPosition = data.logoPosition ?? "top_center";

  p.background(ctx);

  const logoPct = (data.logoScale ?? 100) / 100;

  // Background watermark — independent of logoPosition now, so it can
  // sit underneath the small positioned logo mark rather than replacing
  // it. Drawn first, low opacity, so everything else sits on top of it.
  // A "Picture watermark or Text watermark" choice, the same idea Word's
  // own watermark dialog offers.
  if (logoImage && data.watermarkType === "logo") {
    const maxSize = 480 * logoPct;
    const scale = Math.min(maxSize / logoImage.width, maxSize / logoImage.height);
    const w = logoImage.width * scale;
    const h = logoImage.height * scale;
    ctx.save();
    // 0.07 read as "not showing at all" in practice, especially for a
    // multi-color logo — this is the same "washed out" strength Word's
    // own picture-watermark preset uses, clearly visible without
    // fighting the text on top of it.
    ctx.globalAlpha = 0.16;
    ctx.drawImage(logoImage, WIDTH / 2 - w / 2, HEIGHT / 2 - h / 2, w, h);
    ctx.restore();
  } else if (data.watermarkType === "text" && data.watermarkText) {
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = p.heading;
    ctx.textAlign = "center";
    // Shrinks long text to fit rather than spilling off the certificate.
    let fontSize = 100;
    ctx.font = `800 ${fontSize}px ${p.headingFont}`;
    while (ctx.measureText(data.watermarkText.toUpperCase()).width > WIDTH * 0.85 && fontSize > 30) {
      fontSize -= 4;
      ctx.font = `800 ${fontSize}px ${p.headingFont}`;
    }
    ctx.fillText(data.watermarkText.toUpperCase(), 0, 0);
    ctx.restore();
  }

  // Border frame
  if (template === "premium_embossed") {
    drawEmbossedFrame(ctx, p.accent);
  } else {
    ctx.strokeStyle = p.border;
    ctx.lineWidth = 6;
    ctx.strokeRect(30, 30, WIDTH - 60, HEIGHT - 60);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(45, 45, WIDTH - 90, HEIGHT - 90);
  }

  // Royal Seal's signature mark — a drawn medallion instead of relying
  // on an uploaded logo. Sits above the company name; pick a non-center
  // logo position for this template if you also want a logo, to avoid overlap.
  if (template === "royal_seal") {
    drawSeal(ctx, WIDTH / 2, 78, 38, p.accent);
  }

  // Logo mark — kept at its own natural colors (unlike signatures, a brand
  // logo shouldn't be recolored to the template palette). Anchored by its
  // BOTTOM edge (not center) so making it bigger grows it upward into the
  // top margin instead of down into the company name/title text below.
  // Each position also gets a hard max width/height — without one, a large
  // scale% could grow the logo past the border frame or off the top edge
  // entirely; the cap keeps it inside the frame at any scale setting.
  if (logoImage) {
    const LOGO_BOTTOM_Y = 106;
    const clampToBox = (w: number, h: number, maxW: number, maxH: number): [number, number] => {
      let cw = w, ch = h;
      if (cw > maxW) { ch *= maxW / cw; cw = maxW; }
      if (ch > maxH) { cw *= maxH / ch; ch = maxH; }
      return [cw, ch];
    };
    const drawLogo = (cx: number, boxW: number, boxH: number, maxW: number, maxH: number) => {
      const scale = Math.min((boxW * logoPct) / logoImage.width, (boxH * logoPct) / logoImage.height);
      const [w, h] = clampToBox(logoImage.width * scale, logoImage.height * scale, maxW, maxH);
      ctx.drawImage(logoImage, cx - w / 2, LOGO_BOTTOM_Y - h, w, h);
    };
    if (logoPosition === "top_center") drawLogo(WIDTH / 2, 150, 64, 220, 56);
    else if (logoPosition === "top_left") drawLogo(140, 90, 80, 170, 56);
    else if (logoPosition === "top_right") drawLogo(WIDTH - 140, 90, 80, 170, 56);
  }

  // Candidate photo — always top-right, regardless of logo placement, so
  // the two never compete for the same spot. When the design reserves
  // the spot but no photo has been attached yet (e.g. the settings
  // preview, or an issued certificate nobody's added a photo to), a
  // dashed placeholder shows where it will go.
  if (data.photoEnabled) {
    drawPhoto(ctx, data.photoFrame ?? "circle", photoImage, WIDTH - 115, 115, 55, p.accent, p.muted);
  }

  ctx.textAlign = "center";

  // Company name — the only element with its own alignment control;
  // everything else below always stays centered. Sits comfortably below
  // the logo's max-height footprint (bottom edge 106, capped at 56 tall,
  // so its top never passes y=50) — no more collision at any logo scale.
  const nameAlign = data.companyNameAlign ?? "center";
  const nameX = nameAlign === "left" ? 70 : nameAlign === "right" ? WIDTH - 70 : WIDTH / 2;
  ctx.textAlign = nameAlign;
  ctx.fillStyle = p.muted;
  ctx.font = `600 22px ${p.bodyFont}`;
  ctx.fillText(data.companyName.toUpperCase(), nameX, 138);
  ctx.textAlign = "center";

  // Title
  if (template === "premium_embossed") {
    drawMetallicText(ctx, data.title, WIDTH / 2, 210, `700 54px ${p.headingFont}`);
  } else {
    ctx.fillStyle = p.accent;
    ctx.font = `700 54px ${p.headingFont}`;
    ctx.fillText(data.title, WIDTH / 2, 210);
  }

  // Achievement line
  ctx.fillStyle = p.body;
  ctx.font = `italic 22px ${p.bodyFont}`;
  ctx.fillText(data.achievementLine, WIDTH / 2, 260);

  // Candidate name
  ctx.fillStyle = p.heading;
  ctx.font = `700 62px ${p.headingFont}`;
  ctx.fillText(data.candidateName, WIDTH / 2, 350);

  // Underline flourish
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 220, 375);
  ctx.lineTo(WIDTH / 2 + 220, 375);
  ctx.stroke();

  // Quiz title + score
  ctx.fillStyle = p.body;
  ctx.font = `24px ${p.bodyFont}`;
  ctx.fillText(`for successfully completing`, WIDTH / 2, 430);
  ctx.font = `700 30px ${p.headingFont}`;
  ctx.fillStyle = p.heading;
  ctx.fillText(data.quizTitle, WIDTH / 2, 470);
  ctx.font = `600 24px ${p.bodyFont}`;
  ctx.fillStyle = p.accent;
  ctx.fillText(data.scoreLine, WIDTH / 2, 510);

  // Date
  ctx.fillStyle = p.muted;
  ctx.font = `18px ${p.bodyFont}`;
  ctx.fillText(`Issued on ${data.issuedDate}`, WIDTH / 2, 555);

  // Award badge — an optional medal/seal in the open space above the
  // signature line, independent of the template's own decorations.
  if (data.awardSeal && data.awardSeal !== "none") {
    drawAwardSeal(ctx, data.awardSeal, WIDTH / 2, 635, p.accent);
  }

  // Signatures
  const sigY = 720;
  const BASE_SIG_BOX_W = 280;
  const BASE_SIG_BOX_H = 90;
  const drawSignature = (
    x: number,
    name?: string | null,
    title?: string | null,
    image?: HTMLImageElement | HTMLCanvasElement | null,
    scalePercent?: number | null,
    nameScalePercent?: number | null
  ) => {
    if (!name) return;
    if (image) {
      // Fit the (already whitespace-trimmed) signature image into a box
      // sized by scalePercent (default 100%), preserving its aspect ratio,
      // sitting just above the line.
      const pct = (scalePercent ?? 100) / 100;
      const boxW = BASE_SIG_BOX_W * pct;
      const boxH = BASE_SIG_BOX_H * pct;
      const scale = Math.min(boxW / image.width, boxH / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      // Real signature scans are almost always dark ink — recolor the shape
      // to the template's own heading color (light on a dark template, dark
      // on a light one) instead of drawing it as-is, so it's never a dark
      // signature invisible against a dark background.
      const tinted = tintImage(image, p.heading);
      ctx.drawImage(tinted, x - w / 2, sigY - 6 - h, w, h);
    }
    ctx.strokeStyle = p.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 130, sigY);
    ctx.lineTo(x + 130, sigY);
    ctx.stroke();
    const namePct = (nameScalePercent ?? 100) / 100;
    ctx.fillStyle = p.heading;
    ctx.font = `600 ${Math.round(20 * namePct)}px ${p.bodyFont}`;
    ctx.fillText(name, x, sigY + 28);
    ctx.fillStyle = p.muted;
    ctx.font = `${Math.round(14 * namePct)}px ${p.bodyFont}`;
    ctx.fillText(title ?? "", x, sigY + 48);
  };

  const signatureMode = data.signatureMode ?? "both";
  if (signatureMode === "single") {
    const align = data.signatureAlign ?? "center";
    const x = align === "left" ? WIDTH / 2 - 250 : align === "right" ? WIDTH / 2 + 250 : WIDTH / 2;
    // Whichever signatory actually has a name filled in wins — some admins
    // have historically only filled in Signatory 2, so "single" shouldn't
    // silently render nothing just because slot 1 is the empty one.
    if (data.signatory1Name) {
      drawSignature(x, data.signatory1Name, data.signatory1Title, sig1Image, data.signatory1Scale, data.signatory1NameScale);
    } else {
      drawSignature(x, data.signatory2Name, data.signatory2Title, sig2Image, data.signatory2Scale, data.signatory2NameScale);
    }
  } else if (data.signatory1Name || data.signatory2Name) {
    drawSignature(WIDTH / 2 - 250, data.signatory1Name, data.signatory1Title, sig1Image, data.signatory1Scale, data.signatory1NameScale);
    drawSignature(WIDTH / 2 + 250, data.signatory2Name, data.signatory2Title, sig2Image, data.signatory2Scale, data.signatory2NameScale);
  }

  // Cert number, bottom-right, small
  ctx.textAlign = "right";
  ctx.fillStyle = p.muted;
  ctx.font = `13px ${p.bodyFont}`;
  ctx.fillText(`Certificate No: ${data.certNumber}`, WIDTH - 60, HEIGHT - 55);
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}

export const CERT_TEMPLATE_LABELS: Record<CertTemplate, string> = {
  classic_gold: "🏅 Classic Gold",
  royal_blue: "💙 Royal Blue",
  modern_purple: "💜 Modern Purple",
  minimal_white: "◻ Minimal White",
  dark_elegant: "⬛ Dark Elegant",
  premium_embossed: "✨ Premium Embossed",
  royal_seal: "🏵️ Royal Seal",
};
