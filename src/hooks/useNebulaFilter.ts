import { useEffect, useState, useCallback } from 'react';

const STORAGE_PREFIX = 'noparrot:nebula-filter';

/**
 * Phase 4.5 — Stato del filtro "macro-categoria" applicato al Diario Cognitivo.
 * Persistente in sessionStorage (per-utente target del profilo) così sopravvive
 * a navigazione fuori/rientro nel profilo, ma si reset chiudendo il browser.
 *
 * Tap di nuovo sullo stesso pianeta → deseleziona (toggle).
 */
export function useNebulaFilter(userId: string | undefined) {
  const storageKey = userId ? `${STORAGE_PREFIX}:${userId}` : STORAGE_PREFIX;

  const [selectedMacro, setSelectedMacroState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return sessionStorage.getItem(storageKey);
    } catch {
      return null;
    }
  });

  // Quando cambia userId (es. navigazione tra profili) re-idratiamo dal nuovo key
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = sessionStorage.getItem(storageKey);
      setSelectedMacroState(stored);
    } catch {
      /* noop */
    }
  }, [storageKey]);

  // Sincronizza con sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (selectedMacro) {
        sessionStorage.setItem(storageKey, selectedMacro);
      } else {
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      /* noop */
    }
  }, [selectedMacro, storageKey]);

  const setSelectedMacro = useCallback((macro: string | null) => {
    setSelectedMacroState(prev => {
      // Toggle: tap sullo stesso pianeta deseleziona
      if (prev === macro) return null;
      return macro;
    });
  }, []);

  const clearFilter = useCallback(() => {
    setSelectedMacroState(null);
  }, []);

  return { selectedMacro, setSelectedMacro, clearFilter };
}