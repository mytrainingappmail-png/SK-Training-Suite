// Canvas-based certificate rendering — 5 distinct, colorful templates.
// No external fonts/images required, so it always renders identically
// regardless of company branding being configured or not.

import type { CertTemplate, CertLogoPosition, CertSignatureMode, CertSignatureAlign } from "../../types/quiz";

export interface CertificateData {
  candidateName: string;
  quizTitle: string;
  scoreLine: string;
  certNumber: string;
  issuedDate: string;
  companyName: string;
  logoUrl?: string | null;
  logoPosition?: CertLogoPosition | null;
  logoScale?: number | null;
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
}

const WIDTH = 1200;
const HEIGHT = 850;
// Canvas is rasterized at 2x and downscaled by CSS/PNG export — sharpens
// signature images and text (previously rendered at native 1200x850,
// which looked soft/blurry once a signature photo was scaled up into its box).
const RENDER_SCALE = 2;

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

/** The candidate's own photo, admin-attached after issuance — a circular
 * frame with a colored ring, fixed in the top-right corner so it never
 * collides with the logo (which defaults to top-center). */
function drawPhotoCircle(ctx: CanvasRenderingContext2D, image: HTMLImageElement, cx: number, cy: number, r: number, ringColor: string): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const scale = Math.max((r * 2) / image.width, (r * 2) / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.drawImage(image, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();

  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

export async function renderCertificateToCanvas(canvas: HTMLCanvasElement, template: CertTemplate, data: CertificateData): Promise<void> {
  const [sig1ImageRaw, sig2ImageRaw, logoImage, photoImage] = await Promise.all([
    loadImage(data.signatory1ImageUrl),
    loadImage(data.signatory2ImageUrl),
    loadImage(data.logoUrl),
    loadImage(data.photoEnabled ? data.photoUrl : null),
  ]);
  const sig1Image = sig1ImageRaw ? trimTransparentEdges(sig1ImageRaw) : null;
  const sig2Image = sig2ImageRaw ? trimTransparentEdges(sig2ImageRaw) : null;

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

  // Watermark logo — drawn first, low opacity, so everything else sits on top of it.
  if (logoImage && logoPosition === "watermark") {
    const maxSize = 460 * logoPct;
    const scale = Math.min(maxSize / logoImage.width, maxSize / logoImage.height);
    const w = logoImage.width * scale;
    const h = logoImage.height * scale;
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.drawImage(logoImage, WIDTH / 2 - w / 2, HEIGHT / 2 - h / 2, w, h);
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
  if (logoImage && logoPosition !== "watermark") {
    const LOGO_BOTTOM_Y = 127;
    const drawLogo = (cx: number, boxW: number, boxH: number) => {
      const scale = Math.min((boxW * logoPct) / logoImage.width, (boxH * logoPct) / logoImage.height);
      const w = logoImage.width * scale;
      const h = logoImage.height * scale;
      ctx.drawImage(logoImage, cx - w / 2, LOGO_BOTTOM_Y - h, w, h);
    };
    if (logoPosition === "top_center") drawLogo(WIDTH / 2, 150, 64);
    else if (logoPosition === "top_left") drawLogo(140, 90, 80);
    else if (logoPosition === "top_right") drawLogo(WIDTH - 140, 90, 80);
  }

  // Candidate photo — always top-right, regardless of logo placement, so
  // the two never compete for the same spot. When the design reserves
  // the spot but no photo has been attached yet (e.g. the settings
  // preview, or an issued certificate nobody's added a photo to), a
  // dashed placeholder shows where it will go.
  if (data.photoEnabled) {
    if (photoImage) {
      drawPhotoCircle(ctx, photoImage, WIDTH - 115, 115, 55, p.accent);
    } else {
      ctx.save();
      ctx.strokeStyle = p.muted;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(WIDTH - 115, 115, 55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.textAlign = "center";

  // Company name
  ctx.fillStyle = p.muted;
  ctx.font = `600 22px ${p.bodyFont}`;
  ctx.fillText(data.companyName.toUpperCase(), WIDTH / 2, 130);

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
