/**
 * Fonte unica dei colori "pianeta" per la shell (Profilo / Messaggi / Cerca /
 * Notifiche). Deliberatamente NON riusa `CATEGORY_COLORS` di `config/categories`
 * (che alimenta i filtri del feed): la shell adotta la palette dei territori
 * come da spec redesign (Scienza teal, Economia orange).
 *
 * I valori qui devono restare allineati alle CSS var `--t-*` in `index.css`.
 */
import { normalizeCategory } from "@/config/categories";

export type TerritoryName =
  | "Cultura"
  | "Scienza"
  | "Tecnologia"
  | "Ambiente"
  | "Benessere"
  | "Società"
  | "Politica"
  | "Economia";

export const TERRITORY_COLORS: Record<TerritoryName, string> = {
  Cultura: "#A78BFA",
  Scienza: "#2AD2C9",
  Tecnologia: "#0A7AFF",
  Ambiente: "#22C55E",
  Benessere: "#F472B6",
  Società: "#E41E52",
  Politica: "#FFD464",
  Economia: "#F97316",
};

const CSS_VAR_MAP: Record<TerritoryName, string> = {
  Cultura: "--t-cultura",
  Scienza: "--t-scienza",
  Tecnologia: "--t-tecnologia",
  Ambiente: "--t-ambiente",
  Benessere: "--t-benessere",
  Società: "--t-societa",
  Politica: "--t-politica",
  Economia: "--t-economia",
};

export const TERRITORY_ORDER: TerritoryName[] = [
  "Cultura",
  "Scienza",
  "Tecnologia",
  "Ambiente",
  "Benessere",
  "Società",
  "Politica",
  "Economia",
];

/** Colore hex di un territorio (dopo normalizzazione da alias/varianti). */
export function getTerritoryColor(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const norm = (normalizeCategory(raw) ?? raw) as TerritoryName;
  return TERRITORY_COLORS[norm];
}

/** Restituisce la CSS var (`var(--t-…)`) associata, se il territorio è noto. */
export function getTerritoryCssVar(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const norm = (normalizeCategory(raw) ?? raw) as TerritoryName;
  const key = CSS_VAR_MAP[norm];
  return key ? `var(${key})` : undefined;
}

/** Etichetta canonica del territorio (per label uppercase mono). */
export function getTerritoryLabel(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  return (normalizeCategory(raw) ?? raw) as TerritoryName;
}