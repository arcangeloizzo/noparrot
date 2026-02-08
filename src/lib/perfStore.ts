// Performance monitoring store for DEV mode
// Provides render counting and action tracking for optimization analysis
// NOTE: Listeners only notified on toggle/start/endAction - NOT on increments (no lag)

import { useState, useEffect, useRef } from 'react';

type RenderCounts = {
  postCard: number;
  editorialSlide: number;
};

type ActionType = 'scroll' | 'like' | 'idle';

interface PerfSnapshot {
  postCard: number;
  editorialSlide: number;
  timestamp: number;
}

interface PerfStoreState {
  enabled: boolean;
  counts: RenderCounts;
  lastAction: ActionType;
  baseline: PerfSnapshot | null;
  delta: { postCard: number; editorialSlide: number } | null;
  listeners: Set<() => void>;
}

interface PerfStoreMethods {
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  incrementPostCard: () => void;
  incrementEditorialSlide: () => void;
  startAction: (action: ActionType) => void;
  endAction: () => void;
  subscribe: (fn: () => void) => () => void;
  getState: () => { 
    enabled: boolean; 
    counts: RenderCounts; 
    lastAction: ActionType;
    delta: { postCard: number; editorialSlide: number } | null;
  };
}

// Allowed emails for perf overlay access
const ALLOWED_EMAILS = ['ark@', 'test@', 'dev@'];

// Check if user email is in allowlist
export const isEmailAllowed = (email: string | undefined): boolean => {
  if (!email) return false;
  return ALLOWED_EMAILS.some(prefix => email.toLowerCase().startsWith(prefix));
};

// Create store with methods as a class-like pattern
const createPerfStore = (): PerfStoreState & PerfStoreMethods => {
  const state: PerfStoreState = {
    enabled: false,
    counts: { postCard: 0, editorialSlide: 0 },
    lastAction: 'idle',
    baseline: null,
    delta: null,
    listeners: new Set(),
  };

  const notifyListeners = () => {
    state.listeners.forEach(fn => fn());
  };

  const methods: PerfStoreMethods = {
    enable() {
      state.enabled = true;
      state.counts = { postCard: 0, editorialSlide: 0 };
      notifyListeners();
    },
    
    disable() {
      state.enabled = false;
      state.delta = null;
      state.baseline = null;
      state.lastAction = 'idle';
      notifyListeners();
    },
    
    toggle() {
      if (state.enabled) {
        methods.disable();
      } else {
        methods.enable();
      }
    },
    
    // INCREMENT: NO notification - silent counter update
    incrementPostCard() {
      if (!state.enabled) return;
      state.counts.postCard++;
      // NO notifyListeners() here - that's what was causing lag!
    },
    
    // INCREMENT: NO notification - silent counter update
    incrementEditorialSlide() {
      if (!state.enabled) return;
      state.counts.editorialSlide++;
      // NO notifyListeners() here - that's what was causing lag!
    },
    
    startAction(action: ActionType) {
      if (!state.enabled) return;
      state.lastAction = action;
      state.baseline = {
        postCard: state.counts.postCard,
        editorialSlide: state.counts.editorialSlide,
        timestamp: Date.now()
      };
      state.delta = null;
      notifyListeners(); // OK to notify on action start
    },
    
    endAction() {
      if (!state.enabled || !state.baseline) return;
      
      // Calculate delta after 2 animation frames
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!state.baseline) return;
          
          state.delta = {
            postCard: state.counts.postCard - state.baseline.postCard,
            editorialSlide: state.counts.editorialSlide - state.baseline.editorialSlide
          };
          notifyListeners(); // OK to notify on action end (shows delta)
        });
      });
    },
    
    subscribe(fn: () => void) {
      state.listeners.add(fn);
      return () => { state.listeners.delete(fn); };
    },
    
    getState() {
      return {
        enabled: state.enabled,
        counts: { ...state.counts },
        lastAction: state.lastAction,
        delta: state.delta ? { ...state.delta } : null
      };
    }
  };
  
  return { ...state, ...methods };
};

// Export singleton
export const perfStore = createPerfStore();

// React hook for subscribing to store
export const usePerfStore = () => {
  const [currentState, setCurrentState] = useState(perfStore.getState());
  
  useEffect(() => {
    return perfStore.subscribe(() => {
      setCurrentState(perfStore.getState());
    });
  }, []);
  
  return currentState;
};
