/**
 * Unified media type — spec v1.1 §M4.
 * Single shape for user uploads AND extracted media (OG image, YouTube thumbnail,
 * Spotify cover, Instagram Reel thumb, Daily Focus cover).
 *
 * Always rendered as array: length 1 = no carousel UI, length >1 = carousel UI.
 * Spec §5.4: in carousel mixed orientations, the first element's ratio dictates layout.
 */
export interface UnifiedMedia {
  /** URL principale, full-size */
  src: string;
  /** URL originale full resolution per ExpandedViewer */
  originalSrc?: string;
  /** Ratio clampato al più vicino tra 9:16, 3:4, 1:1, 16:9 (spec §M2) */
  ratio: '9:16' | '3:4' | '1:1' | '16:9' | '4:3' | '3:2';
  /** Derivato da ratio: 9:16/3:4 = portrait, 1:1 = square, 16:9 = landscape */
  orientation: 'portrait' | 'landscape' | 'square';
  /** Versione downscale per AmbientLayer §S2. Può === src se la sorgente è già piccola. */
  ambientSrc: string;
  /** Per branching minore al render: play overlay su video, halo su audio-cover, ecc. */
  kind: 'image' | 'video' | 'audio-cover';
  /** Sorgente di origine del media */
  source: 'user_upload' | 'link_preview';
  /** Larghezza originaria in pixel */
  width?: number | null;
  /** Altezza originaria in pixel */
  height?: number | null;
  /** Durata del video in secondi */
  duration_sec?: number | null;
}
