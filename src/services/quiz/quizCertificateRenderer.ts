// Canvas-based certificate rendering — 5 distinct, colorful templates.
// No external fonts/images required, so it always renders identically
// regardless of company branding being configured or not.

import type { CertTemplate } from "../../types/quiz";

export interface CertificateData {
  candidateName: string;
  quizTitle: string;
  scoreLine: string;
  certNumber: string;
  issuedDate: string;
  companyName: string;
  title: string;
  achievementLine: string;
  signatory1Name?: string | null;
  signatory1Title?: string | null;
  signatory1ImageUrl?: string | null;
  signatory1Scale?: number | null;
  signatory2Name?: string | null;
  signatory2Title?: string | null;
  signatory2ImageUrl?: string | null;
  signatory2Scale?: number | null;
}

const WIDTH = 1200;
const HEIGHT = 850;

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

/** Recolors every non-transparent pixel of an image to a solid color while keeping its original alpha/shape — turns a scanned signature (almost always dark ink) into whatever color the certificate template needs it to be, instead of assuming it's always light-on-dark or dark-on-light. */
function tintImage(image: HTMLImageElement, color: string): HTMLCanvasElement {
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

export async function renderCertificateToCanvas(canvas: HTMLCanvasElement, template: CertTemplate, data: CertificateData): Promise<void> {
  const [sig1Image, sig2Image] = await Promise.all([loadImage(data.signatory1ImageUrl), loadImage(data.signatory2ImageUrl)]);

  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const p = PALETTES[template] ?? PALETTES.dark_elegant;

  p.background(ctx);

  // Border frame
  ctx.strokeStyle = p.border;
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, WIDTH - 60, HEIGHT - 60);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(45, 45, WIDTH - 90, HEIGHT - 90);

  ctx.textAlign = "center";

  // Company name
  ctx.fillStyle = p.muted;
  ctx.font = `600 22px ${p.bodyFont}`;
  ctx.fillText(data.companyName.toUpperCase(), WIDTH / 2, 130);

  // Title
  ctx.fillStyle = p.accent;
  ctx.font = `700 54px ${p.headingFont}`;
  ctx.fillText(data.title, WIDTH / 2, 210);

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
    image?: HTMLImageElement | null,
    scalePercent?: number | null
  ) => {
    if (!name) return;
    if (image) {
      // Fit the signature image into a box (sized by scalePercent, default
      // 100%), preserving its aspect ratio, sitting just above the line.
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
      ctx.drawImage(tinted, x - w / 2, sigY - 10 - h, w, h);
    }
    ctx.strokeStyle = p.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 130, sigY);
    ctx.lineTo(x + 130, sigY);
    ctx.stroke();
    ctx.fillStyle = p.heading;
    ctx.font = `600 20px ${p.bodyFont}`;
    ctx.fillText(name, x, sigY + 28);
    ctx.fillStyle = p.muted;
    ctx.font = `14px ${p.bodyFont}`;
    ctx.fillText(title ?? "", x, sigY + 48);
  };

  if (data.signatory1Name || data.signatory2Name) {
    drawSignature(WIDTH / 2 - 250, data.signatory1Name, data.signatory1Title, sig1Image, data.signatory1Scale);
    drawSignature(WIDTH / 2 + 250, data.signatory2Name, data.signatory2Title, sig2Image, data.signatory2Scale);
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
};
