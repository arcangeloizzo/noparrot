import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const STORAGE_KEY = 'noparrot_composer_draft';
export const PENDING_SHARE_KEY = 'noparrot_pending_share_redirect';

export default function ShareTargetHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Wait for auth to initialize
    const title = searchParams.get('title') || '';
    const text = searchParams.get('text') || '';
    const url = searchParams.get('url') || '';

    // Combine incoming data into composer text logic
    let content = '';
    let detectedUrl = url;

    // Se c'è solo URL,mettilo in content per far scattare il parsing URL regex del Composer,
    // oppure se c'è testo e url, uniscili in markdown format
    if (text && url) {
      // Often OS share targets put the URL inside the text field anyway,
      // but if both are provided separately:
      content = `${text}\n${url}`;
    } else if (text) {
      content = text;
      // Extract URL from text if needed (Composer does this too, but we do it to pass `detectedUrl`)
      const urlMatch = text.match(/(https?:\/\/[^\s]+)/g);
      if (urlMatch && !detectedUrl) {
        detectedUrl = urlMatch[0];
      }
    } else if (url) {
      content = url;
    } else if (title) {
      content = title;
    }

    if (content.trim() || detectedUrl) {
      const state = {
        content: content.trim(),
        detectedUrl: detectedUrl || null,
        timestamp: Date.now()
      };
      
      // Scrivi direttamente nello storage usato dal Composer persistence
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      console.log('[ShareTarget] Salvato contenuto condiviso:', state);

      if (user) {
        toast.info('Contenuto ricevuto! Sto aprendo il composer...');
        // User logged in, redirect to feed with open composer state
        navigate('/', { replace: true, state: { openComposer: true } });
      } else {
        toast.info('Effettua l\'accesso per condividere questo contenuto.');
        // User not logged in, set flag and redirect to auth
        localStorage.setItem(PENDING_SHARE_KEY, 'true');
        navigate('/auth', { replace: true });
      }
    } else {
      // Nothing shared, just go home
      navigate('/', { replace: true });
    }
  }, [searchParams, navigate, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">
          Ricezione contenuto in corso...
        </p>
      </div>
    </div>
  );
}
