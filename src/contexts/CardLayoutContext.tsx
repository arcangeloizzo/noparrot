import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CardLayoutContextValue {
  /** Altezza netta in pixel disponibile per il corpo della card */
  availableHeight: number;
  /** True se la risoluzione verticale utile è molto ridotta (es. iPhone SE) */
  isSmallScreen: boolean;
  /** Altezza totale della viewport (dvh) */
  viewportHeight: number;
}

const CardLayoutContext = createContext<CardLayoutContextValue | undefined>(undefined);

export const CardLayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [layout, setLayout] = useState<CardLayoutContextValue>({
    availableHeight: 380, // Fallback sicuro
    isSmallScreen: false,
    viewportHeight: 667,
  });

  useEffect(() => {
    const calculateLayout = () => {
      const h = window.innerHeight; // Ottiene 100dvh reale
      
      // Calcolo dei safe area insets (fallback se non supportati tramite CSS variabili)
      const root = document.documentElement;
      const safeAreaTop = parseInt(getComputedStyle(root).getPropertyValue('--sat').replace('px', '')) || 0;
      const safeAreaBottom = parseInt(getComputedStyle(root).getPropertyValue('--sab').replace('px', '')) || 0;
      
      // Calcolo fallback in pixel se getComputedStyle non rileva nulla (es. iOS non ha popolato le variabili custom)
      // Usiamo stime conservative in base all'altezza dello schermo per dispositivi noti
      const resolvedSafeAreaTop = safeAreaTop > 0 ? safeAreaTop : (h >= 800 ? 47 : 20);
      const resolvedSafeAreaBottom = safeAreaBottom > 0 ? safeAreaBottom : (h >= 800 ? 34 : 0);
      
      // Padding calcolati da diagnosi Fase 1:
      // Top: safe-area + 154px (Header globale 72px + HeaderRail 82px)
      // Bottom: safe-area + 164px (BottomNav 64px + Spacing 36px + ActionRail 64px)
      const topPadding = resolvedSafeAreaTop + 154;
      const bottomPadding = resolvedSafeAreaBottom + 164;
      
      const netHeight = h - topPadding - bottomPadding;
      const available = Math.max(netHeight, 280);
      const isSmall = h <= 700;

      console.log('[CardLayout]', { 
        availableHeight: available, 
        isSmallScreen: isSmall, 
        viewportHeight: h,
        safeAreaTop: resolvedSafeAreaTop,
        safeAreaBottom: resolvedSafeAreaBottom
      });

      setLayout({
        availableHeight: available, // Almeno 280px garantiti
        isSmallScreen: isSmall, // Identifica iPhone SE e simili
        viewportHeight: h,
      });
    };

    calculateLayout();
    window.addEventListener('resize', calculateLayout);
    return () => window.removeEventListener('resize', calculateLayout);
  }, []);

  return (
    <CardLayoutContext.Provider value={layout}>
      {children}
    </CardLayoutContext.Provider>
  );
};

export const useCardLayout = () => {
  const context = useContext(CardLayoutContext);
  if (!context) {
    throw new Error('useCardLayout deve essere usato dentro CardLayoutProvider');
  }
  return context;
};
