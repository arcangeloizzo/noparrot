import { useEffect } from 'react';

/**
 * Sets a stable --vh CSS custom property based on window.innerHeight at mount.
 * Refreshes only on orientationchange (NOT on Safari URL bar toggle).
 * Prevents scroll-snap teleporting caused by dvh oscillation.
 */
export function useStableViewportHeight() {
  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVh();
    window.addEventListener('orientationchange', setVh);
    return () => window.removeEventListener('orientationchange', setVh);
  }, []);
}