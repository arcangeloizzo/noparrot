import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ReactNode } from "react";

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

const TRAJECTORY_STYLE: React.CSSProperties = {
  background: "linear-gradient(120deg, #E41E52, #A78BFA)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
  fontWeight: 600,
};

const FOCUS_STYLE: React.CSSProperties = {
  color: "#FFD464",
  fontWeight: 600,
};

/**
 * Splits the narrative into React nodes, applying gradient highlight to
 * trajectory_label (first occurrence) and yellow highlight to focus_phrase
 * (first occurrence). Handles overlap gracefully.
 */
function renderNarrative(
  narrative: string,
  trajectoryLabel: string,
  focusPhrase: string
): ReactNode[] {
  const trajectory = trajectoryLabel?.trim() || "";
  const focus = focusPhrase?.trim() || "";

  // Detect overlap (one contains the other) — apply only the outer one.
  let useTrajectory = !!trajectory;
  let useFocus = !!focus;

  if (useTrajectory && useFocus) {
    const tLow = trajectory.toLowerCase();
    const fLow = focus.toLowerCase();
    if (tLow.includes(fLow)) {
      console.warn("[PulseCard] focus_phrase contained inside trajectory_label, skipping focus highlight");
      useFocus = false;
    } else if (fLow.includes(tLow)) {
      console.warn("[PulseCard] trajectory_label contained inside focus_phrase, skipping trajectory highlight");
      useTrajectory = false;
    }
  }

  // Find first occurrence (case-insensitive) of each phrase.
  const matches: Array<{ start: number; end: number; type: "trajectory" | "focus" }> = [];

  if (useTrajectory) {
    const re = new RegExp(escapeRegex(trajectory), "i");
    const m = narrative.match(re);
    if (m && m.index !== undefined) {
      matches.push({ start: m.index, end: m.index + m[0].length, type: "trajectory" });
    }
  }

  if (useFocus) {
    const re = new RegExp(escapeRegex(focus), "i");
    const m = narrative.match(re);
    if (m && m.index !== undefined) {
      const start = m.index;
      const end = start + m[0].length;
      // Skip if this match overlaps the trajectory match
      const overlaps = matches.some((existing) => start < existing.end && end > existing.start);
      if (!overlaps) {
        matches.push({ start, end, type: "focus" });
      }
    }
  }

  matches.sort((a, b) => a.start - b.start);

  if (matches.length === 0) {
    return [narrative];
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, idx) => {
    if (cursor < match.start) {
      nodes.push(narrative.slice(cursor, match.start));
    }
    const text = narrative.slice(match.start, match.end);
    if (match.type === "trajectory") {
      nodes.push(
        <strong key={`traj-${idx}`} style={TRAJECTORY_STYLE}>
          {text}
        </strong>
      );
    } else {
      nodes.push(
        <span key={`focus-${idx}`} style={FOCUS_STYLE}>
          {text}
        </span>
      );
    }
    cursor = match.end;
  });
  if (cursor < narrative.length) {
    nodes.push(narrative.slice(cursor));
  }
  return nodes;
}

export const PulseCard = () => {
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
          ✦ Pulse della settimana
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
          <>{renderNarrative(data.narrative, data.trajectory_label, data.focus_phrase)}</>
        )}
      </div>

      {/* STREAK FOOTER */}
      {!isLoading && !isError && data && (data.streak_days > 0 || data.count_week > 0) && (
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            fontWeight: 500,
            color: "hsl(var(--muted-foreground))",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
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
          {/* TODO: Esplora correlati → (future step) */}
        </div>
      )}
    </div>
  );
};
