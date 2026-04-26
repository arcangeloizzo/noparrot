import { useEffect, useState, useCallback } from 'react';

const STORAGE_PREFIX = 'noparrot:nebula-filter';

export interface SelectedTopic {
  id: string;
  label: string;
  /** Macro a cui il topic appartiene (per coerenza filtro). */
  macro: string;
}

/**
 * Phase 4.5 / 4.6c — Stato del filtro Nebulosa applicato al Diario Cognitivo.
 * Due dimensioni indipendenti ma coerenti: macro-categoria + topic specifico.
 *
 * Regole:
 * - Toggle: tap sullo stesso valore lo deseleziona (sia macro che topic).
 * - Coerenza: se imposto un topic, la sua macro viene auto-selezionata.
 * - Reset macro → reset anche topic (un topic senza macro non ha senso).
 * - Persistente in sessionStorage per-userId (sopravvive a navigazione interna).
 */
export function useNebulaFilter(userId: string | undefined) {
  const macroKey = userId
    ? `${STORAGE_PREFIX}:macro:${userId}`
    : `${STORAGE_PREFIX}:macro`;
  const topicKey = userId
    ? `${STORAGE_PREFIX}:topic:${userId}`
    : `${STORAGE_PREFIX}:topic`;

  const [selectedMacro, setSelectedMacroState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return sessionStorage.getItem(macroKey);
    } catch {
      return null;
    }
  });

  const [selectedTopic, setSelectedTopicState] = useState<SelectedTopic | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(topicKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SelectedTopic;
      if (!parsed?.id || !parsed?.label || !parsed?.macro) return null;
      return parsed;
    } catch {
      return null;
    }
  });

  // Re-idratazione quando cambia userId (navigazione tra profili)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setSelectedMacroState(sessionStorage.getItem(macroKey));
      const raw = sessionStorage.getItem(topicKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SelectedTopic;
        setSelectedTopicState(
          parsed?.id && parsed?.label && parsed?.macro ? parsed : null
        );
      } else {
        setSelectedTopicState(null);
      }
    } catch {
      /* noop */
    }
  }, [macroKey, topicKey]);

  // Sync macro → sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (selectedMacro) sessionStorage.setItem(macroKey, selectedMacro);
      else sessionStorage.removeItem(macroKey);
    } catch {
      /* noop */
    }
  }, [selectedMacro, macroKey]);

  // Sync topic → sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (selectedTopic) sessionStorage.setItem(topicKey, JSON.stringify(selectedTopic));
      else sessionStorage.removeItem(topicKey);
    } catch {
      /* noop */
    }
  }, [selectedTopic, topicKey]);

  // Coerenza: se cambia macro e il topic appartiene a un'altra macro → reset topic.
  useEffect(() => {
    if (selectedTopic && selectedTopic.macro !== selectedMacro) {
      setSelectedTopicState(null);
    }
  }, [selectedMacro, selectedTopic]);

  const setSelectedMacro = useCallback((macro: string | null) => {
    setSelectedMacroState(prev => {
      // Toggle: tap sullo stesso pianeta deseleziona (e azzera anche il topic)
      if (prev === macro) {
        setSelectedTopicState(null);
        return null;
      }
      // Cambio macro → topic precedente non più valido
      setSelectedTopicState(null);
      return macro;
    });
  }, []);

  const setSelectedTopic = useCallback((topic: SelectedTopic | null) => {
    if (topic === null) {
      setSelectedTopicState(null);
      return;
    }
    // Auto-imposta la macro coerente
    setSelectedMacroState(topic.macro);
    setSelectedTopicState(prev => {
      // Toggle: tap sullo stesso topic deseleziona
      if (prev?.id === topic.id) return null;
      return topic;
    });
  }, []);

  const clearFilter = useCallback(() => {
    setSelectedMacroState(null);
    setSelectedTopicState(null);
  }, []);

  const clearTopicOnly = useCallback(() => {
    setSelectedTopicState(null);
  }, []);

  return {
    selectedMacro,
    selectedTopic,
    setSelectedMacro,
    setSelectedTopic,
    clearFilter,
    clearTopicOnly,
  };
}