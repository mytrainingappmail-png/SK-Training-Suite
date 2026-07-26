// Canvas-based "shareable session result card" for the ADMIN/host — a
// square PNG summarising the just-finished quiz (podium + pass/fail
// breakdown) built for pasting straight into a company WhatsApp/Slack
// group, distinct from the per-trainee certificate.

export interface SessionResultCardParticipant {
  display_name: string;
  percent: number;
}

export interface SessionResultCardData {
  quizTitle: string;
  pin: string;
  participants: SessionResultCardParticipant[];
  passCount: number;
  improveCount: number;
  failCount: number;
  brandName?: string | null;
}

const SIZE = 1080;
const MEDALS = ["🥇", "🥈", "🥉"];

export function renderSessionResultCardToCanvas(canvas: HTMLCanvasElement, data: SessionResultCardData): void {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  g.addColorStop(0, "#0F172A");
  g.addColorStop(1, "#1E1B4B");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.strokeStyle = "rgba(251,191,36,0.5)";
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 28, SIZE - 56, SIZE - 56);

  ctx.textAlign = "center";

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "600 26px Arial, sans-serif";
  ctx.fillText((data.brandName || "LIVE QUIZ").toUpperCase(), SIZE / 2, 95);

  ctx.fillStyle = "#FDE68A";
  ctx.font = "700 44px Arial, sans-serif";
  wrapText(ctx, data.quizTitle, SIZE / 2, 170, SIZE - 160, 52);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "22px Arial, sans-serif";
  ctx.fillText(`${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · PIN ${data.pin}`, SIZE / 2, 250);

  // Podium (top 3)
  const top3 = data.participants.slice(0, 3);
  const podiumY = 340;
  const spacing = 260;
  const startX = SIZE / 2 - spacing;

  top3.forEach((p, i) => {
    const x = startX + i * spacing;
    ctx.font = "72px Arial";
    ctx.fillText(MEDALS[i], x, podiumY);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 30px Arial, sans-serif";
    ctx.fillText(truncate(p.display_name, 14), x, podiumY + 60);
    ctx.fillStyle = "#FDE68A";
    ctx.font = "700 26px Arial, sans-serif";
    ctx.fillText(`${p.percent}%`, x, podiumY + 95);
    ctx.fillStyle = "#FFFFFF";
  });

  // Pass/Improve/Fail summary
  const summaryY = 560;
  const boxW = 280;
  const boxes = [
    { label: "PASS", value: data.passCount, color: "#10B981" },
    { label: "IMPROVE", value: data.improveCount, color: "#F59E0B" },
    { label: "FAIL", value: data.failCount, color: "#EF4444" },
  ];
  boxes.forEach((b, i) => {
    const x = SIZE / 2 - boxW - 20 + i * (boxW + 20);
    ctx.fillStyle = `${b.color}22`;
    roundRect(ctx, x, summaryY, boxW, 120, 16);
    ctx.fill();
    ctx.strokeStyle = `${b.color}88`;
    ctx.lineWidth = 2;
    roundRect(ctx, x, summaryY, boxW, 120, 16);
    ctx.stroke();
    ctx.fillStyle = b.color;
    ctx.font = "700 48px Arial, sans-serif";
    ctx.fillText(String(b.value), x + boxW / 2, summaryY + 60);
    ctx.font = "600 20px Arial, sans-serif";
    ctx.fillText(b.label, x + boxW / 2, summaryY + 95);
  });

  // Full participant list
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "600 22px Arial, sans-serif";
  ctx.fillText(`${data.participants.length} PARTICIPANT${data.participants.length === 1 ? "" : "S"}`, SIZE / 2, 750);

  ctx.textAlign = "left";
  const listX = 100;
  let listY = 800;
  const listItems = data.participants.slice(0, 8);
  listItems.forEach((p, i) => {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "600 24px Arial, sans-serif";
    ctx.fillText(`${i + 1}. ${truncate(p.display_name, 26)}`, listX, listY);
    ctx.textAlign = "right";
    ctx.fillStyle = "#FDE68A";
    ctx.fillText(`${p.percent}%`, SIZE - 100, listY);
    ctx.textAlign = "left";
    listY += 34;
  });
  if (data.participants.length > listItems.length) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "20px Arial, sans-serif";
    ctx.fillText(`+ ${data.participants.length - listItems.length} more…`, listX, listY);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "20px Arial, sans-serif";
  ctx.fillText("Powered by Live Quiz", SIZE / 2, SIZE - 45);
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}
