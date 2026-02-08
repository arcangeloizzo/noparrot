import { usePalette } from 'react-palette';
import { useMemo } from 'react';

export interface DominantColors {
  primary: string;
  secondary: string;
  accent: string;
  loading: boolean;
  error: Error | undefined;
}

interface UseDominantColorsOptions {
  /** Skip fetching - useful for cards not near the active index */
  skip?: boolean;
}

const DEFAULT_COLORS: DominantColors = {
  primary: '#1F3347',
  secondary: '#0d1117',
  accent: '#ffffff',
  loading: false,
  error: undefined
};

export const useDominantColors = (
  imageUrl: string | undefined, 
  options: UseDominantColorsOptions = {}
): DominantColors => {
  const { skip = false } = options;
  
  // Pass empty string when skipped to prevent network request
  const urlToFetch = skip ? '' : (imageUrl || '');
  const { data, loading, error } = usePalette(urlToFetch);
  
  return useMemo(() => {
    // Return defaults immediately if skipped
    if (skip) return DEFAULT_COLORS;
    
    return {
      primary: data?.darkVibrant || data?.vibrant || '#1F3347',
      secondary: data?.darkMuted || data?.muted || '#0d1117',
      accent: data?.lightVibrant || '#ffffff',
      loading,
      error
    };
  }, [data, loading, error, skip]);
};
