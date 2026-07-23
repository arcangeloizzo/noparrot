import { CATEGORY_COLORS, normalizeCategory } from "@/config/categories";
import { computeNebulaLayout } from "@/lib/nebulaLayout";
import LogoOrizzontale from "@/assets/LogoBianco.png";

export interface NebulaShareData {
  displayName: string;
  handle?: string | null;
  comprehensionCount: number;
  byMacro: Record<string, number>; // macro -> count/density
  /** Optional integer territory counts, preferred for labels and layout. */
  byMacroCounts?: Record<string, number>;
  /** Plain-text weekly Pulse narrative. */
  pulseText?: string | null;
  /** Dominant territory hex color for the gradient. Optional. */
  dominantColor?: string;
}

const W = 1080;
const H = 1920;

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      (document as any).fonts?.load?.("80px Anton"),
      (document as any).fonts?.load?.("200px Anton"),
      (document as any).fonts?.load?.("40px Anton"),
      (document as any).fonts?.load?.("30px Inter"),
      (document as any).fonts?.load?.("28px 'JetBrains Mono'"),
      (document as any).fonts?.load?.("22px 'JetBrains Mono'"),
      (document as any).fonts?.load?.("24px 'JetBrains Mono'"),
    ]);
    await (document as any).fonts?.ready;
  } catch {
    /* best-effort */
  }
}

/**
 * 1080x1920 Instagram-Story share card of the user's cognitive nebula.
 * Layout: logo → name → hero count → real nebula → legend → footer.
 */
export async function generateNebulaShareImage(
  data: NebulaShareData
): Promise<Blob> {
  await ensureFonts();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // ---- Background: solid + two subtle radials (matches app body) ----
  ctx.fillStyle = "#0E1522";
  ctx.fillRect(0, 0, W, H);

  const g1 = ctx.createRadialGradient(W * 0.18, H * 0.12, 0, W * 0.18, H * 0.12, W * 0.75);
  g1.addColorStop(0, "rgba(10,122,255,0.18)");
  g1.addColorStop(1, "rgba(10,122,255,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  const g2 = ctx.createRadialGradient(W * 0.88, H * 0.92, 0, W * 0.88, H * 0.92, W * 0.85);
  g2.addColorStop(0, "rgba(228,30,82,0.14)");
  g2.addColorStop(1, "rgba(228,30,82,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  // Faint grain
  ctx.globalAlpha = 0.035;
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#000000";
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;

  const MARGIN = 80;

  // ---- 1) Logo at the top ----
  try {
    const logo = await loadImage(LogoOrizzontale);
    const logoH = 84;
    const logoW = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, (W - logoW) / 2, 80, logoW, logoH);
  } catch {
    // Fallback: text wordmark if logo fails to load
    ctx.fillStyle = "#ffffff";
    ctx.font = "400 64px 'Anton', 'Impact', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NOPARROT", W / 2, 140);
  }

  // ---- 2) User name ----
  const nameY = 260;
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "400 72px 'Anton', 'Impact', sans-serif";
  const nameText = (data.displayName || "NoParrot").toUpperCase();
  ctx.fillText(nameText, MARGIN, nameY);

  // ---- 3) Hero counter (gradient white → dominant) + "COSE / COMPRESE" ----
  const dominant = data.dominantColor || "#A78BFA";
  const heroY = nameY + 200; // baseline for the giant number
  const countText = String(data.comprehensionCount ?? 0);

  ctx.font = "400 200px 'Anton', 'Impact', sans-serif";
  const numWidth = ctx.measureText(countText).width;

  const grad = ctx.createLinearGradient(MARGIN, heroY - 180, MARGIN + numWidth, heroY);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, dominant);
  ctx.fillStyle = grad;
  ctx.textAlign = "left";
  ctx.fillText(countText, MARGIN, heroY);

  // Label to the right of the number, bottom-aligned
  const labelX = MARGIN + numWidth + 28;
  ctx.font = "500 28px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("COSE", labelX, heroY - 44);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 28px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText("COMPRESE", labelX, heroY - 8);

  const hasPulse = Boolean(data.pulseText?.trim());
  const countsForLayout = normalizeCounts(data.byMacroCounts, data.byMacro);

  // ---- 4) Real nebula (shared layout) ----
  const NEB_TOP = heroY + 44;
  const NEB_H = hasPulse ? 700 : 800;
  const NEB_W = W;
  const layout = computeNebulaLayout(countsForLayout, NEB_W, NEB_H, {
    minRadius: hasPulse ? 22 : 26,
    maxRadius: hasPulse ? 96 : 110,
  });

  ctx.save();
  ctx.translate(0, NEB_TOP);

  // Draw planets (fill 14%, border 45%, matches app)
  layout.planets.forEach((p) => {
    if (p.radius <= 0) return;
    const rgb = hexToRgb(p.color);

    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.14)`;
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.45)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Sparse particles inside (no glow)
    const count = Math.min(28, Math.floor(4 + (p.radius / 110) * 24));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * p.radius * 0.85;
      const px = p.cx + Math.cos(a) * d;
      const py = p.cy + Math.sin(a) * d;
      const size = 1.5 + Math.random() * 0.6;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.65)`;
      ctx.fill();
    }
  });

  ctx.restore();

  // ---- 5) Legend of active territories, 2 columns ----
  const active = layout.planets
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);

  const LEG_TOP = NEB_TOP + NEB_H + 8;
  const COL_W = (W - MARGIN * 2) / 2;
  const ROW_H = hasPulse ? 40 : 44;
  ctx.font = "500 24px 'JetBrains Mono', ui-monospace, monospace";

  active.forEach((p, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * COL_W;
    const y = LEG_TOP + row * ROW_H;

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x + 10, y - 8, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textAlign = "left";
    ctx.fillText(p.name.toUpperCase(), x + 34, y);

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.textAlign = "right";
    ctx.fillText(String(Math.round(p.count)), x + COL_W - 28, y);
    ctx.textAlign = "left";
  });

  // ---- 6) Weekly Pulse card (optional) ----
  const legendRows = Math.ceil(active.length / 2);
  const legendBottom = LEG_TOP + Math.max(legendRows, 1) * ROW_H;
  if (hasPulse) {
    drawPulseCard(ctx, data.pulseText!.trim(), MARGIN, legendBottom + 34, W - MARGIN * 2);
  }

  // ---- 7) Footer: hairline + wordmark + tagline ----
  const FOOTER_TOP = H - 160;
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, FOOTER_TOP);
  ctx.lineTo(W - MARGIN, FOOTER_TOP);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "400 40px 'Anton', 'Impact', sans-serif";
  ctx.fillText("NOPARROT", W / 2, FOOTER_TOP + 60);

  ctx.fillStyle = "rgba(255,255,255,0.40)";
  ctx.font = "500 22px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText("Read. Understand. Then share.", W / 2, FOOTER_TOP + 100);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
      0.92
    );
  });
}

function normalizeCounts(
  byMacroCounts: Record<string, number> | undefined,
  byMacro: Record<string, number>
): Record<string, number> {
  const source = byMacroCounts && Object.keys(byMacroCounts).length > 0 ? byMacroCounts : byMacro;
  const normalized: Record<string, number> = {};
  Object.entries(source || {}).forEach(([key, value]) => {
    const normalizedKey = normalizeCategory(key) ?? key;
    normalized[normalizedKey] = (normalized[normalizedKey] || 0) + Math.max(0, Math.round(Number(value) || 0));
  });
  return normalized;
}

function drawPulseCard(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number
): void {
  const padding = 48;
  const radius = 24;
  const cardHeight = 300;

  roundedRect(ctx, x, y, width, cardHeight, radius);
  ctx.fillStyle = "rgba(26,35,54,0.65)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#22C55E";
  ctx.beginPath();
  ctx.arc(x + padding + 8, y + padding - 6, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "700 22px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.48)";
  ctx.textAlign = "left";
  ctx.fillText("PULSE DELLA SETTIMANA", x + padding + 30, y + padding);

  ctx.font = "400 30px Inter, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const lines = wrapText(ctx, text, width - padding * 2, 5);
  const lineHeight = 45;
  lines.forEach((line, i) => {
    ctx.fillText(line, x + padding, y + padding + 62 + i * lineHeight);
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const n =
    h.length === 3
      ? h.split("").map((c) => c + c).join("")
      : h;
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

// Re-export for callers that want to compute the dominant color themselves.
export function pickDominantColor(byMacro: Record<string, number>): string {
  let best: string | null = null;
  let bestVal = 0;
  for (const [k, v] of Object.entries(byMacro || {})) {
    const key = normalizeCategory(k) ?? k;
    if ((v ?? 0) > bestVal) {
      bestVal = v ?? 0;
      best = key;
    }
  }
  return (best && CATEGORY_COLORS[best]) || "#A78BFA";
}