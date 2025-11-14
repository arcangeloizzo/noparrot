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
export const LOGO_BASE = '/src/assets/Logo.png'; // Now using Logo BG Dark.png
export const LOGO_BASE_DARK = '/src/assets/Logo.png';
export const LOGO_EXTENDED = "/src/assets/Logo Orizzontale.png";
export const LOGO_EXTENDED_DARK = "src/assets/Logo Orizzontale.png";

// Navigation Feature Flags
export const NAV_PROFILE_AS_HOME = false; // Changed: keep Home icon, replace Profile icon with avatar

// Tooltips
export const TOOLTIPS = {
  TRUST_SCORE: "Il Trust Score indica l'affidabilità della fonte a cui è collegato questo post, basato su reputazione e qualità storica. Non è un giudizio sul contenuto.",
  NO_SOURCES: "Questo post non include fonti. Per trasparenza non è stato calcolato alcun Trust Score.",
} as const;

// Reader Gate Configuration
export const READER_GATE_CONFIG = {
  // Modalità: soft (nessun blocco), guardrail (default, attrito soft), strict (blocco hard per education)
  mode: "guardrail" as "soft" | "guardrail" | "strict",
  
  // Coverage threshold (0-1): % del blocco che deve essere visibile nel viewport
  coverageThreshold: 0.85,
  
  // Dwell time base (ms) - minimo assoluto per blocchi molto corti
  minDwellBaseMs: 2500,
  
  // Dwell time per 100 parole (ms) - scala dinamicamente con word count
  dwellPer100wMs: 600,
  
  // Dwell time massimo per blocco (ms) - cap per blocchi lunghissimi
  maxDwellMs: 8000,
  
  // Velocità scroll massima (px/s) - oltre questa si applica attrito temporaneo
  maxScrollVelocityPxPerSec: 2500,
  
  // Unlock threshold (0-1): % blocchi letti per sbloccare test
  unlockThreshold: 0.8,
  
  // Grace ratio (0-1): % blocchi saltabili (es. 0.15 ≈ 1 ogni 6)
  graceRatio: 0.15,
  
  // Rispetta prefers-reduced-motion (disabilita animazioni/attrito se true)
  respectReducedMotion: true,
  
  // Debug mode (console logs dettagliati)
  debug: false,
  
  // Progressive Reveal
  visibleAheadBlocks: 2,                        // Quanti blocchi "ahead" vedere oltre quello corrente
  blockStyle: 'blur' as 'blur' | 'hidden' | 'locked',  // Stile di blocco: blur, hidden, locked
  hardScrollLock: true,                          // Impedisci scroll fisicamente oltre limite
  showBlockOverlay: true,                        // Mostra overlay sui blocchi locked
} as const;
