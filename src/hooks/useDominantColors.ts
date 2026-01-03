import { usePalette } from 'react-palette';
import { useMemo } from 'react';

export interface DominantColors {
  primary: string;
  secondary: string;
  accent: string;
  loading: boolean;
  error: Error | undefined;
}

export const useDominantColors = (imageUrl: string | undefined): DominantColors => {
  const { data, loading, error } = usePalette(imageUrl || '');
  
  return useMemo(() => ({
    primary: data?.darkVibrant || data?.vibrant || '#1F3347',
    secondary: data?.darkMuted || data?.muted || '#0d1117',
    accent: data?.lightVibrant || '#ffffff',
    loading,
    error
  }), [data, loading, error]);
};
