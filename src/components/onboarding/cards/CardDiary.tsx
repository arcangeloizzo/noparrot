import { CATEGORY_COLORS } from "@/config/categories";
import { CardBase } from "./CardBase";

const PLANETS: Array<{ label: string; color: string; cx: number; cy: number; r: number }> = [
  { label: "CULTURA",    color: CATEGORY_COLORS.Cultura,    cx: 32,  cy: 40, r: 18 },
  { label: "AMBIENTE",   color: CATEGORY_COLORS.Ambiente,   cx: 108, cy: 22, r: 14 },
  { label: "SOCIETÀ",    color: CATEGORY_COLORS.Società,    cx: 76,  cy: 96, r: 20 },
  { label: "SCIENZA",    color: CATEGORY_COLORS.Scienza,    cx: 138, cy: 88, r: 12 },
  { label: "TECNOLOGIA", color: CATEGORY_COLORS.Tecnologia, cx: 30,  cy: 122, r: 15 },
  { label: "POLITICA",   color: CATEGORY_COLORS.Politica,   cx: 130, cy: 148, r: 13 },
];

export const CardDiary = () => (
  <CardBase
    eyebrow={<span style={{ color: CATEGORY_COLORS.Cultura }}>Il tuo diario cognitivo</span>}
    title={<>OGNI COSA CAPITA<br />LASCIA UN SEGNO.</>}
    body={
      <>
        Ogni comprensione accende un punto nella tua{" "}
        <strong style={{ color: "#FFFFFF", fontWeight: 600 }}>nebulosa</strong>:
        otto territori che mostrano dove stai esplorando. Il tuo profilo diventa un{" "}
        <strong style={{ color: "#FFFFFF", fontWeight: 600 }}>diario cognitivo</strong>{" "}
        — racconta come pensi, non quanto urli.
      </>
    }
    extra={
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          aria-hidden
          style={{ flexShrink: 0 }}
        >
          {PLANETS.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.cx}
                cy={p.cy}
                r={p.r}
                fill={p.color}
                fillOpacity={0.14}
                stroke={p.color}
                strokeOpacity={0.45}
                strokeWidth={1}
              />
              <circle cx={p.cx} cy={p.cy} r={1.5} fill={p.color} />
              <text
                x={p.cx + p.r + 4}
                y={p.cy + 3}
                fill="rgba(255,255,255,0.55)"
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
                fontSize="7"
                letterSpacing="0.12em"
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>
        <div>
          <div
            style={{
              fontFamily: "'Anton', 'Impact', sans-serif",
              fontSize: 46,
              lineHeight: 1,
              background: `linear-gradient(180deg, #FFFFFF 0%, ${CATEGORY_COLORS.Società} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            33
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 9.5,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
              marginTop: 6,
              lineHeight: 1.3,
            }}
          >
            COSE
            <br />
            COMPRESE
          </div>
        </div>
      </div>
    }
  />
);