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
 * Determina il test mode basato sul numero di parole dell'utente
 * quando è presente una fonte esterna
 */
export function getTestModeWithSource(userWordCount: number): TestMode {
  if (userWordCount <= 30) {
    return 'SOURCE_ONLY';   // 3 domande sulla fonte
  } else if (userWordCount <= 120) {
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
