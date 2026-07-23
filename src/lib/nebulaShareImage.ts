import { CATEGORY_COLORS, CATEGORY_NAMES, normalizeCategory } from "@/config/categories";
import { computeNebulaLayout } from "@/lib/nebulaLayout";
// Raster asset used by the FAB (blue parrot). PNG is the safe path for
// canvas drawImage on Safari/WebKit — the SVG codepath with a 9-arg source
// rect was unreliable and was falling back to the wordmark.
import LogoRasterAsset from "@/assets/Logo.png";

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

// Lowercase category name → hex, for word-by-word colored rendering in the
// Pulse text. Case-insensitive lookup, punctuation is stripped from the token.
const CATEGORY_LOOKUP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const name of CATEGORY_NAMES) {
    map[name.toLowerCase()] = CATEGORY_COLORS[name];
  }
  return map;
})();

const PULSE_BASE_COLOR = "rgba(255,255,255,0.85)";
const PULSE_PADDING = 48;
const PULSE_EYEBROW_ZONE = 62; // dot + eyebrow row
const PULSE_LINE_HEIGHT = 44;
const PULSE_RADIUS = 24;
const PULSE_BODY_FONT = "400 30px Inter, system-ui, sans-serif";
const PULSE_BODY_FONT_BOLD = "600 30px Inter, system-ui, sans-serif";

function stripPunct(word: string): string {
  return word.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");
}

function categoryColorForWord(word: string): string | null {
  const stripped = stripPunct(word).toLowerCase();
  if (!stripped) return null;
  return CATEGORY_LOOKUP[stripped] ?? null;
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
 * Layout: name + logo → hero count → poster nebula → Pulse → footer.
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

  // ---- 1) Current FAB logo at top-right, with conic brand ring ----
  try {
    const logo = await loadImage(LogoRasterAsset);
    drawFabLogo(ctx, logo, W - MARGIN - 120, MARGIN, 120);
  } catch (err) {
    console.warn("[nebulaShareImage] logo raster failed, using wordmark fallback", err);
    ctx.fillStyle = "#ffffff";
    ctx.font = "400 42px 'Anton', 'Impact', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("NOPARROT", W - MARGIN, 148);
  }

  // ---- 2) User name ----
  const nameY = 156;
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "400 72px 'Anton', 'Impact', sans-serif";
  const nameText = (data.displayName || "NoParrot").toUpperCase();
  drawFittedText(ctx, nameText, MARGIN, nameY, W - MARGIN * 2 - 154, 72, "'Anton', 'Impact', sans-serif");

  // ---- 3) Hero counter (gradient white → dominant) + "COSE / COMPRESE" ----
  const dominant = data.dominantColor || "#A78BFA";
  const heroY = nameY + 230; // baseline for the giant number
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

  // ---- 4) Poster nebula (shared layout, richer visual only for share image) ----
  const NEB_TOP = heroY + 54;
  const NEB_H = hasPulse ? 760 : 1030;
  const NEB_W = W;
  const layout = computeNebulaLayout(countsForLayout, NEB_W, NEB_H, {
    minRadius: hasPulse ? 28 : 32,
    maxRadius: hasPulse ? 116 : 132,
  });

  ctx.save();
  ctx.translate(0, NEB_TOP);

  layout.planets.forEach((p) => drawPosterPlanet(ctx, p, layout.cx, layout.cy, W));

  ctx.restore();

  // ---- 5) Weekly Pulse card (optional) ----
  const pulseTop = NEB_TOP + NEB_H + (hasPulse ? 28 : 0);
  let pulseBottom = pulseTop;
  if (hasPulse) {
    pulseBottom = drawPulseCard(ctx, data.pulseText!.trim(), MARGIN, pulseTop, W - MARGIN * 2);
  }

  // ---- 6) Footer: hairline + wordmark + tagline ----
  // Ensure at least 60px of air between Pulse card and the footer hairline.
  const FOOTER_TOP = Math.max(H - 160, pulseBottom + 60);
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

function drawFabLogo(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  x: number,
  y: number,
  size: number
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const radius = size / 2;

  const ring = ctx.createConicGradient(-Math.PI / 2, cx, cy);
  ring.addColorStop(0, "#0A7AFF");
  ring.addColorStop(0.33, "#E41E52");
  ring.addColorStop(0.66, "#FFD464");
  ring.addColorStop(1, "#0A7AFF");
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(13,18,28,0.88)";
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 10, 0, Math.PI * 2);
  ctx.clip();
  // Same crop used by LogoVertical hideText viewBox: "120 60 720 720".
  ctx.drawImage(logo, 120, 60, 720, 720, x + 5, y + 5, size - 10, size - 10);
  ctx.restore();
}

function drawPosterPlanet(
  ctx: CanvasRenderingContext2D,
  p: { name: string; color: string; count: number; cx: number; cy: number; radius: number },
  nebulaCx: number,
  nebulaCy: number,
  canvasWidth: number
): void {
  if (p.radius <= 0 || p.count <= 0) return;
  const rgb = hexToRgb(p.color);

  const halo = ctx.createRadialGradient(p.cx, p.cy, p.radius * 0.72, p.cx, p.cy, p.radius * 1.35);
  halo.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`);
  halo.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, p.radius * 1.35, 0, Math.PI * 2);
  ctx.fill();

  const fill = ctx.createRadialGradient(
    p.cx - p.radius * 0.2,
    p.cy - p.radius * 0.2,
    0,
    p.cx,
    p.cy,
    p.radius
  );
  fill.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.32)`);
  fill.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0.08)`);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.55)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
  ctx.stroke();

  const particleCount = Math.min(44, Math.floor(10 + (p.radius / 116) * 34));
  for (let i = 0; i < particleCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * p.radius * 0.86;
    const px = p.cx + Math.cos(a) * d;
    const py = p.cy + Math.sin(a) * d;
    const size = 1.5 + Math.random() * 0.5;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.85)`;
    ctx.fill();
  }

  drawPlanetLabel(ctx, p, nebulaCx, nebulaCy, canvasWidth);
}

function drawPlanetLabel(
  ctx: CanvasRenderingContext2D,
  p: { name: string; color: string; count: number; cx: number; cy: number; radius: number },
  nebulaCx: number,
  nebulaCy: number,
  canvasWidth: number
): void {
  const dx = p.cx - nebulaCx;
  const dy = p.cy - nebulaCy;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const outwardX = horizontal ? (dx >= 0 ? 1 : -1) : dx >= 0 ? 0.55 : -0.55;
  const outwardY = horizontal ? (dy >= 0 ? 0.25 : -0.25) : dy >= 0 ? 1 : -1;
  const rawX = p.cx + outwardX * (p.radius + 24);
  const rawY = p.cy + outwardY * (p.radius + 20);
  const label = `${p.name.toUpperCase()} · ${Math.round(p.count)}`;

  ctx.font = "700 22px 'JetBrains Mono', ui-monospace, monospace";
  const textWidth = ctx.measureText(label).width;
  const alignRight = outwardX < 0;
  const minX = 52;
  const maxX = canvasWidth - 52;
  let x = alignRight ? rawX : rawX;
  if (alignRight && x - textWidth < minX) x = minX + textWidth;
  if (!alignRight && x + textWidth > maxX) x = maxX - textWidth;

  ctx.textAlign = alignRight ? "right" : "left";
  ctx.fillStyle = p.color;
  ctx.fillText(label, x, rawY);
  ctx.textAlign = "left";
}

function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  fontFamily: string
): void {
  let size = fontSize;
  do {
    ctx.font = `400 ${size}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size >= 44);
  ctx.fillText(text, x, y);
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