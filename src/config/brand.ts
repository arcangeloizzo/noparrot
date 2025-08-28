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

// Logo Data URIs (from uploaded assets)
export const LOGO_BASE = "data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='50' cy='50' r='45' fill='%230A7AFF'/%3E%3Ccircle cx='35' cy='35' r='12' fill='white'/%3E%3Ccircle cx='35' cy='35' r='6' fill='%231F3347'/%3E%3Cpath d='M20 60 Q30 50 40 60' fill='%231F3347'/%3E%3C/svg%3E";

export const LOGO_BASE_DARK = "data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='50' cy='50' r='45' fill='%23BFE9E9'/%3E%3Ccircle cx='35' cy='35' r='12' fill='white'/%3E%3Ccircle cx='35' cy='35' r='6' fill='%231F3347'/%3E%3Cpath d='M20 60 Q30 50 40 60' fill='%231F3347'/%3E%3C/svg%3E";

export const LOGO_EXTENDED = "data:image/svg+xml,%3Csvg viewBox='0 0 200 50' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='25' cy='25' r='20' fill='%230A7AFF'/%3E%3Ccircle cx='18' cy='18' r='6' fill='white'/%3E%3Ccircle cx='18' cy='18' r='3' fill='%231F3347'/%3E%3Cpath d='M10 30 Q15 25 20 30' fill='%231F3347'/%3E%3Ctext x='55' y='32' font-family='Inter' font-weight='600' font-size='18' fill='%231F3347'%3ENO%3C/text%3E%3Ctext x='85' y='32' font-family='Inter' font-weight='600' font-size='18' fill='%230A7AFF'%3EPARROT%3C/text%3E%3C/svg%3E";

export const LOGO_EXTENDED_DARK = "data:image/svg+xml,%3Csvg viewBox='0 0 200 50' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='25' cy='25' r='20' fill='%23BFE9E9'/%3E%3Ccircle cx='18' cy='18' r='6' fill='white'/%3E%3Ccircle cx='18' cy='18' r='3' fill='%231F3347'/%3E%3Cpath d='M10 30 Q15 25 20 30' fill='%231F3347'/%3E%3Ctext x='55' y='32' font-family='Inter' font-weight='600' font-size='18' fill='%23BFE9E9'%3ENO%3C/text%3E%3Ctext x='85' y='32' font-family='Inter' font-weight='600' font-size='18' fill='%23BFE9E9'%3EPARROT%3C/text%3E%3C/svg%3E";

// Navigation Feature Flags
export const NAV_PROFILE_AS_HOME = true;

// Tooltips
export const TOOLTIPS = {
  TRUST_SCORE: "Il Trust Score indica l'affidabilità della fonte a cui è collegato questo post, basato su reputazione e qualità storica. Non è un giudizio sul contenuto.",
  NO_SOURCES: "Questo post non include fonti. Per trasparenza non è stato calcolato alcun Trust Score.",
} as const;