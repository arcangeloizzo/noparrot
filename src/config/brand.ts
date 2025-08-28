// NOPARROT Brand Configuration
export const BRAND_COLORS = {
  PRIMARY_BLUE: '#0A7AFF',
  DARK_BLUE: '#1F3347',
  LIGHT_BLUE: '#BFE9E9',
  LIGHT_GRAY: '#F2F7F7',
  BRAND_PINK: '#E41E52',
  BRAND_YELLOW: '#FFD464',
} as const;

// Trust Score Colors (now using Tailwind classes)
export const TRUST_SCORE_COLORS = {
  BASSO: "bg-trust-low text-trust-low-text",
  MEDIO: "bg-trust-medium text-trust-medium-text",
  ALTO: "bg-trust-high text-trust-high-text",
  NONE: "bg-muted text-muted-foreground"
} as const;

// Logo constants (using actual PNG assets)
export const LOGO_BASE = "/lovable-uploads/4e2d113e-0ba6-45d9-8efe-2022612746f6.png";
export const LOGO_BASE_DARK = "/lovable-uploads/4e2d113e-0ba6-45d9-8efe-2022612746f6.png";
export const LOGO_EXTENDED = "/lovable-uploads/4e2d113e-0ba6-45d9-8efe-2022612746f6.png";
export const LOGO_EXTENDED_DARK = "/lovable-uploads/4e2d113e-0ba6-45d9-8efe-2022612746f6.png";

// Navigation Feature Flags
export const NAV_PROFILE_AS_HOME = false; // Changed: keep Home icon, replace Profile icon with avatar

// Tooltips
export const TOOLTIPS = {
  TRUST_SCORE: "Il Trust Score indica l'affidabilità della fonte a cui è collegato questo post, basato su reputazione e qualità storica. Non è un giudizio sul contenuto.",
  NO_SOURCES: "Questo post non include fonti. Per trasparenza non è stato calcolato alcun Trust Score.",
} as const;