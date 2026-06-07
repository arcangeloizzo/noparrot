import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ReactNode } from "react";
import { CATEGORIES, CATEGORY_COLORS } from "@/config/categories";

interface PulseData {
  narrative: string;
  trajectory_label: string;
  focus_phrase: string;
  streak_days: number;
  count_week: number;
  generated_at: string;
  from_cache: boolean;
  _fallback?: boolean;
}

const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Splits the narrative into React nodes, highlighting every occurrence of a
 * canonical category name (Tecnologia, Politica, …) with the color defined
 * for that category in the Nebula taxonomy.
 */
function renderNarrative(narrative: string): ReactNode[] {
  if (!narrative) return [narrative];

  // Build a single regex matching any canonical category name, case-insensitive,
  // with word boundaries so we don't color random substrings.
  const names = CATEGORIES.map((c) => escapeRegex(c.name));
  const re = new RegExp(`\\b(${names.join("|")})\\b`, "gi");

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = re.exec(narrative)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (cursor < start) nodes.push(narrative.slice(cursor, start));
    // Lookup color via canonical key (capitalized as defined in CATEGORIES)
    const matched = match[0];
    const canonical =
      CATEGORIES.find((c) => c.name.toLowerCase() === matched.toLowerCase())?.name ?? matched;
    const color = CATEGORY_COLORS[canonical] ?? "#A78BFA";
    nodes.push(
      <strong key={`cat-${idx++}`} style={{ color, fontWeight: 600 }}>
        {matched}
      </strong>
    );
    cursor = end;
  }
  if (cursor < narrative.length) nodes.push(narrative.slice(cursor));
  return nodes.length > 0 ? nodes : [narrative];
}

interface PulseCardProps {
  onExploreTap?: () => void;
}

export const PulseCard = ({ onExploreTap }: PulseCardProps = {}) => {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery<PulseData>({
    queryKey: ["pulse-narrative", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-pulse-narrative", {
        body: { force_refresh: false },
      });
      if (error) throw error;
      return data as PulseData;
    },
    enabled: !!user,
    staleTime: TWELVE_HOURS,
    gcTime: TWENTY_FOUR_HOURS,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const cardStyle: React.CSSProperties = {
    padding: "16px 18px",
    borderRadius: 18,
    border: "1px solid rgba(167, 139, 250, 0.2)",
    background: `
      radial-gradient(ellipse at top left, rgba(228, 30, 82, 0.06), transparent 60%),
      radial-gradient(ellipse at bottom right, rgba(10, 122, 255, 0.06), transparent 60%),
      linear-gradient(135deg, rgba(167, 139, 250, 0.04), rgba(255, 212, 100, 0.03))
    `,
    position: "relative",
    overflow: "hidden",
  };

  return (
    <div style={cardStyle}>
      {/* Pulse keyframes (scoped via inline <style>) */}
      <style>{`
        @keyframes pulseCardDot {
          0%, 100% { box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2); }
          50% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.05); }
        }
      `}</style>

      {/* TOP LABEL */}
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#22C55E",
            display: "inline-block",
            animation: "pulseCardDot 2.4s ease-in-out infinite",
          }}
        />
        <span
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#A78BFA",
          }}
        >
          ◆ Pulse della settimana
        </span>
      </div>

      {/* NARRATIVE */}
      <div
        className="text-foreground"
        style={{
          marginTop: 10,
          fontSize: 15,
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: "-0.005em",
        }}
      >
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[92%]" />
            <Skeleton className="h-4 w-[70%]" />
          </div>
        )}
        {isError && !isLoading && (
          <span className="text-muted-foreground">
            Non riesco a leggere la tua pulse in questo momento. Riprova più tardi.
          </span>
        )}
        {!isLoading && !isError && data && (
          <>{renderNarrative(data.narrative)}</>
        )}
      </div>

      {/* STREAK FOOTER */}
      {!isLoading && !isError && data && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid rgba(167, 139, 250, 0.12)",
            fontSize: 12,
            fontWeight: 500,
            color: "hsl(var(--muted-foreground))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {data.streak_days > 0 && (
              <span>
                🔥 <b style={{ color: "hsl(var(--foreground))", fontWeight: 600 }}>{data.streak_days}</b>{" "}
                {data.streak_days === 1 ? "giorno consecutivo" : "giorni consecutivi"}
              </span>
            )}
            {data.streak_days > 0 && data.count_week > 0 && (
              <span aria-hidden style={{ opacity: 0.4 }}>·</span>
            )}
            {data.count_week > 0 && (
              <span>
                <b style={{ color: "hsl(var(--foreground))", fontWeight: 600 }}>{data.count_week}</b>{" "}
                {data.count_week === 1 ? "comprensione" : "comprensioni"} questa settimana
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onExploreTap?.()}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#0A7AFF",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Esplora correlati →
          </button>
        </div>
      )}
    </div>
  );
};
