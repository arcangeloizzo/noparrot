import { BookOpen, Music } from "lucide-react";
import { CATEGORY_COLORS } from "@/config/categories";
import { CardBase } from "./CardBase";

interface CardTryProps {
  onStartDemo: (choice: "article" | "song") => void;
  onSkip: () => void;
}

const teal = "#06B6D4";

function Crow({
  color,
  icon,
  title,
  meta,
  onClick,
}: {
  color: string;
  icon: React.ReactNode;
  title: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "10px 12px 10px 10px",
        background: "rgba(26, 35, 54, 0.72)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 18,
        color: "#FFFFFF",
        cursor: "pointer",
        textAlign: "left",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 8,
          bottom: 8,
          width: 2.5,
          borderRadius: 2,
          background: `linear-gradient(180deg, ${color} 0%, ${color}66 100%)`,
        }}
      />
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `${color}24`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          flexShrink: 0,
          marginLeft: 6,
        }}
      >
        {icon}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 14.5,
            fontWeight: 600,
            color: "#FFFFFF",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 9.5,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          {meta}
        </span>
      </span>
    </button>
  );
}

export const CardTry = ({ onStartDemo, onSkip }: CardTryProps) => (
  <CardBase
    eyebrow={<span style={{ color: teal }}>Ultima cosa</span>}
    title={<>PROVALO.<br />ADESSO.</>}
    body={
      <>
        Scegli un contenuto e passa il tuo primo gate.{" "}
        <strong style={{ color: "#FFFFFF", fontWeight: 600 }}>Due minuti</strong>,
        poi decidi tu.
      </>
    }
    extra={
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Crow
          color={CATEGORY_COLORS.Tecnologia}
          icon={<BookOpen size={22} strokeWidth={1.8} />}
          title="Cos'è NoParrot?"
          meta="Articolo · 2 min di lettura"
          onClick={() => onStartDemo("article")}
        />
        <Crow
          color={CATEGORY_COLORS.Cultura}
          icon={<Music size={22} strokeWidth={1.8} />}
          title="Another Brick in the Wall"
          meta="Pink Floyd · The Wall · 1979"
          onClick={() => onStartDemo("song")}
        />
        <button
          onClick={onSkip}
          style={{
            marginTop: 10,
            background: "transparent",
            border: "none",
            padding: "8px 0",
            color: "rgba(255,255,255,0.55)",
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          Salta e crea l'account →
        </button>
      </div>
    }
  />
);