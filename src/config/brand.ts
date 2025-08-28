// NOPARROT Brand Configuration
export const BRAND_COLORS = {
  PRIMARY_BLUE: '#0A7AFF',
  DARK_BLUE: '#1F3347',
  LIGHT_BLUE: '#BFE9E9',
  LIGHT_GRAY: '#F2F7F7',
  BRAND_PINK: '#E41E52',
  BRAND_YELLOW: '#FFD464',
} as const;

// Trust Score Colors
export const TRUST_SCORE_COLORS = {
  BASSO: { bg: '#20303A', text: '#BFE9E9' },
  MEDIO: { bg: '#16364A', text: '#BFE9E9' },
  ALTO: { bg: '#0E3C62', text: '#BFE9E9' },
  NONE: { bg: '#6B7280', text: '#9CA3AF' },
} as const;

// Logo constants (using actual PNG assets)
export const LOGO_BASE = "/src/assets/parrot-logo.png";
export const LOGO_BASE_DARK = "/src/assets/parrot-logo.png";
export const LOGO_EXTENDED = "/src/assets/parrot-logo.png";
export const LOGO_EXTENDED_DARK = "/src/assets/parrot-logo.png";

// Navigation Feature Flags
export const NAV_PROFILE_AS_HOME = false; // Changed: keep Home icon, replace Profile icon with avatar

// Tooltips
export const TOOLTIPS = {
  TRUST_SCORE: "Il Trust Score indica l'affidabilità della fonte a cui è collegato questo post, basato su reputazione e qualità storica. Non è un giudizio sul contenuto.",
  NO_SOURCES: "Questo post non include fonti. Per trasparenza non è stato calcolato alcun Trust Score.",
} as const;