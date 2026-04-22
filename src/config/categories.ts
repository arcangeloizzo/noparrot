/**
 * NoParrot — Single source of truth for content category taxonomy.
 *
 * 8 macro-categories used across:
 * - AI classifiers (classify-content, publish-post, profile-compose-post)
 * - UI chips, filters, drawers (CategoryChip, CategoryFilterDrawer, CategoryExplorer)
 * - Cognitive Nebula (CompactNebula, CognitiveMap, CognitiveNebulaCanvas)
 *
 * Phase 2 of taxonomy migration: this file introduces the new 8-category set
 * additively. Legacy labels (Salute, Sport, Media, Pianeta, Esteri, plus the
 * "& double" variants like "Società & Politica") are still kept in
 * LEGACY_CATEGORY_MAP so historical posts render with the correct color until
 * Phase 3 (data reclassification) and Phase 4 (cutover) complete.
 */
export interface CategoryDef {
  /** Canonical label stored in DB and used in UI */
  name: string;
  /** Hex color for chips, particles, dots */
  color: string;
  /** Visual emoji for filter drawers / explorer cards */
  emoji: string;
  /** Short display name for tight UIs (e.g. nebula radar labels) */
  shortName: string;
}

export const CATEGORIES: CategoryDef[] = [
  { name: 'Società',    color: '#E41E52', emoji: '🏛️', shortName: 'Società' },
  { name: 'Politica',   color: '#FFD464', emoji: '🗳️', shortName: 'Politica' },
  { name: 'Economia',   color: '#F59E0B', emoji: '💼', shortName: 'Economia' },
  { name: 'Tecnologia', color: '#0A7AFF', emoji: '💻', shortName: 'Tecnologia' },
  { name: 'Scienza',    color: '#06B6D4', emoji: '🔬', shortName: 'Scienza' },
  { name: 'Cultura',    color: '#A78BFA', emoji: '🎨', shortName: 'Cultura' },
  { name: 'Ambiente',   color: '#22C55E', emoji: '🌍', shortName: 'Ambiente' },
  { name: 'Benessere',  color: '#F472B6', emoji: '💗', shortName: 'Benessere' },
];

export const CATEGORY_NAMES = CATEGORIES.map(c => c.name);

/** Quick lookup tables for components that index by category string */
export const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.name, c.color])
);

export const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.name, c.emoji])
);

export const CATEGORY_SHORT_NAMES: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.name, c.shortName])
);

/**
 * Legacy → new mapping. Renders historical posts with the correct color
 * pre-reclassification. Sport/Media/Esteri get a temporary mapping (not
 * a 1:1 semantic match — Phase 3 AI reclassification fixes this).
 */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  // Direct semantic rebrand
  'Salute': 'Benessere',
  'Pianeta': 'Ambiente',
  'Esteri': 'Politica',

  // Temporary placement until Phase 3 AI reclassification
  'Sport': 'Cultura',
  'Media': 'Società',

  // "& double" variants from older taxonomy
  'Società & Politica':       'Società',
  'Economia & Business':      'Economia',
  'Scienza & Tecnologia':     'Tecnologia',
  'Cultura & Arte':           'Cultura',
  'Pianeta & Ambiente':       'Ambiente',
  'Sport & Lifestyle':        'Cultura',
  'Salute & Benessere':       'Benessere',
  'Media & Comunicazione':    'Società',
};

/** Normalize any (legacy or new) category label to its current canonical name. */
export const normalizeCategory = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (CATEGORY_NAMES.includes(trimmed)) return trimmed;
  return LEGACY_CATEGORY_MAP[trimmed] ?? null;
};

/** Get color for any category, with a safe fallback. */
export const getCategoryColor = (category: string | null | undefined): string => {
  const normalized = normalizeCategory(category);
  return normalized ? CATEGORY_COLORS[normalized] : '#9AA3AB';
};

/** Get short display name with fallback to canonical name. */
export const getCategoryShortName = (category: string | null | undefined): string => {
  const normalized = normalizeCategory(category);
  return normalized ? CATEGORY_SHORT_NAMES[normalized] : (category ?? '');
};
