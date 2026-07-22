import { CATEGORY_COLORS } from "@/config/categories";

export interface NebulaShareData {
  displayName: string;
  handle?: string | null;
  comprehensionCount: number;
  byMacro: Record<string, number>; // macro -> density
}

/**
 * Renders a 1080x1920 (Instagram Story) share card of the user's nebula.
 * Returns a Blob (image/png). No animations — a static snapshot.
 */
export async function generateNebulaShareImage(
  data: NebulaShareData
): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background
  const bg = ctx.createRadialGradient(W / 2, H * 0.45, 60, W / 2, H * 0.45, W * 0.9);
  bg.addColorStop(0, "#152238");
  bg.addColorStop(1, "#0E1522");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle grain-like noise (fast)
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#000000";
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  // Nebula center
  const cx = W / 2;
  const cy = H * 0.42;

  // Plot planets on a spiral around the center
  const entries = Object.entries(data.byMacro)
    .filter(([, d]) => d > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxDensity = Math.max(1, ...entries.map(([, d]) => d));

  entries.forEach(([macro, density], i) => {
    const color = CATEGORY_COLORS[macro] ?? "#8892A6";
    const angle = (i / Math.max(1, entries.length)) * Math.PI * 2 - Math.PI / 2;
    const radius = 190 + i * 42;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    const size = 34 + (density / maxDensity) * 58;

    // Glow
    const glow = ctx.createRadialGradient(px, py, 0, px, py, size * 2.4);
    glow.addColorStop(0, hexA(color, 0.55));
    glow.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, size * 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = hexA(color, 0.16);
    ctx.strokeStyle = hexA(color, 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "600 22px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(macro.toUpperCase(), px, py + size + 34);
  });

  // Bottom card
  const cardTop = H * 0.72;
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  roundRect(ctx, 72, cardTop, W - 144, H - cardTop - 140, 32);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Big count
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "400 220px 'Anton', 'Impact', sans-serif";
  ctx.fillText(String(data.comprehensionCount), 110, cardTop + 220);

  // Subtitle
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "500 28px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText("COSE COMPRESE", 110, cardTop + 264);

  // Name
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "600 42px 'Inter', system-ui, sans-serif";
  ctx.fillText(data.displayName, 110, cardTop + 350);

  if (data.handle) {
    ctx.fillStyle = "rgba(255,255,255,0.48)";
    ctx.font = "500 28px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillText(`@${data.handle}`, 110, cardTop + 392);
  }

  // Wordmark bottom
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "400 46px 'Anton', 'Impact', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("NOPARROT", W / 2, H - 72);
  ctx.fillStyle = "rgba(255,255,255,0.36)";
  ctx.font = "500 20px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText("READ. UNDERSTAND. THEN SHARE.", W / 2, H - 42);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
      0.92
    );
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}