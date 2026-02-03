/**
 * Utilities for Comprehension Gate logic
 */

/**
 * Conta le parole in un testo normalizzando gli spazi
 */
export function getWordCount(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Test mode per contenuti CON fonte esterna
 */
export type TestMode = 'SOURCE_ONLY' | 'MIXED' | 'USER_ONLY';

/**
 * Determina il test mode basato sul numero di parole del commento
 * dell'AUTORE ORIGINALE del post quando è presente una fonte esterna.
 * 
 * IMPORTANTE: Questa funzione va usata SOLO in caso di RESHARE.
 * Per share originali (utente condivide fonte per la prima volta),
 * usare sempre SOURCE_ONLY perché non ha senso testare l'utente
 * su contenuto che ha appena scritto lui stesso.
 * 
 * @param originalAuthorWordCount - parole del commento dell'autore originale
 */
export function getTestModeWithSource(originalAuthorWordCount: number): TestMode {
  if (originalAuthorWordCount <= 30) {
    return 'SOURCE_ONLY';   // 3 domande sulla fonte
  } else if (originalAuthorWordCount <= 120) {
    return 'MIXED';          // 1 domanda su userText, 2 sulla fonte
  } else {
    return 'USER_ONLY';      // 3 domande solo su userText
  }
}

/**
 * Determina il numero di domande per contenuti SENZA fonte
 * (contenuti originali lunghi)
 */
export function getQuestionCountWithoutSource(userWordCount: number): 0 | 1 | 3 {
  if (userWordCount <= 30) {
    return 0;  // Nessun gate
  } else if (userWordCount <= 120) {
    return 1;  // Gate light: 1 domanda
  } else {
    return 3;  // Gate completo: 3 domande
  }
}

/**
 * Determina il numero di domande per reshare di post Intent
 * Il testo originale del post è la "fonte cognitiva"
 * @param originalWordCount - parole del testo originale del post Intent
 */
export function getQuestionCountForIntentReshare(originalWordCount: number): 1 | 3 {
  // Per Intent reshare, il gate è sempre attivo (min 30 parole garantite)
  // 30-120 parole: 1 domanda sul testo originale
  // >120 parole: 3 domande sul testo originale
  if (originalWordCount <= 120) {
    return 1;
  } else {
    return 3;
  }
}

/**
 * Risultato della valutazione gate per media
 */
export interface MediaGateResult {
  gateRequired: boolean;
  testMode: TestMode | null;
  questionCount: 0 | 1 | 3;
}

/**
 * Determina il test mode e numero di domande per contenuti MEDIA (video/immagini).
 * 
 * SCENARIO 1 - Media SENZA OCR/Trascrizione:
 *   - ≤30 parole commento: NO GATE
 *   - 31-120 parole: USER_ONLY, 1 domanda
 *   - >120 parole: USER_ONLY, 3 domande
 * 
 * SCENARIO 2 - Media CON OCR/Trascrizione:
 *   - ≤30 parole commento: SOURCE_ONLY, 3 domande sul media
 *   - 31-120 parole: MIXED, 3 domande (1 commento + 2 media)
 *   - >120 parole: USER_ONLY, 3 domande solo sul commento
 * 
 * @param userWordCount - parole del commento dell'utente
 * @param hasExtractedText - true se il media ha OCR/trascrizione valida
 */
export function getMediaTestMode(userWordCount: number, hasExtractedText: boolean): MediaGateResult {
  if (!hasExtractedText) {
    // SCENARIO 1: Media senza testo estratto
    if (userWordCount <= 30) {
      return { gateRequired: false, testMode: null, questionCount: 0 };
    } else if (userWordCount <= 120) {
      return { gateRequired: true, testMode: 'USER_ONLY', questionCount: 1 };
    } else {
      return { gateRequired: true, testMode: 'USER_ONLY', questionCount: 3 };
    }
  } else {
    // SCENARIO 2: Media con testo estratto (OCR/trascrizione)
    if (userWordCount <= 30) {
      return { gateRequired: true, testMode: 'SOURCE_ONLY', questionCount: 3 };
    } else if (userWordCount <= 120) {
      return { gateRequired: true, testMode: 'MIXED', questionCount: 3 };
    } else {
      return { gateRequired: true, testMode: 'USER_ONLY', questionCount: 3 };
    }
  }
}
