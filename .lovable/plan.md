
# Piano: App Resume Handler per Session Recovery

## Problema

Quando l'app torna in primo piano dopo essere stata in background per un periodo prolungato, il token JWT di Supabase potrebbe essere scaduto. Nonostante `autoRefreshToken: true` sia configurato nel client, il refresh automatico non può avvenire mentre l'app è sospesa. Questo causa:
- Errori di autenticazione (401/403) nelle chiamate API
- Gate che fallisce perché le edge functions rifiutano il token
- Query React Query che falliscono silenziosamente

---

## Soluzione

Creare un hook globale `useAppLifecycle` che:
1. Ascolta `visibilitychange` per rilevare il ritorno in primo piano
2. Esegue un health check della sessione al resume
3. Tenta il refresh del token se necessario
4. Invalida le query critiche per garantire dati freschi
5. Gestisce il logout pulito se la sessione è irrecuperabile

---

## Architettura

```text
App.tsx
  └─ QueryClientProvider
       └─ AuthProvider
            └─ AppLifecycleHandler  ← NUOVO COMPONENTE
                 ├─ useAppLifecycle hook
                 │     ├─ visibilitychange listener
                 │     ├─ supabase.auth.getSession()
                 │     ├─ supabase.auth.refreshSession()
                 │     └─ queryClient.invalidateQueries()
                 │
                 └─ Breadcrumb logging per debug
```

---

## Implementazione

### File 1: `src/hooks/useAppLifecycle.ts` (NUOVO)

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addBreadcrumb } from '@/lib/crashBreadcrumbs';
import { toast } from 'sonner';

// Query keys critiche da invalidare al resume
const CRITICAL_QUERY_KEYS = [
  'posts',
  'current-profile', 
  'saved-posts',
  'notifications',
  'daily-focus',
  'message-threads'
];

// Tempo minimo in background per triggerare il check (30 secondi)
const MIN_BACKGROUND_TIME_MS = 30_000;

export function useAppLifecycle() {
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const lastHiddenAt = useRef<number | null>(null);
  const isCheckingSession = useRef(false);

  const handleSessionCheck = useCallback(async () => {
    // Evita check concorrenti
    if (isCheckingSession.current) return;
    isCheckingSession.current = true;

    try {
      addBreadcrumb('session_check_start');
      
      // 1. Prova a ottenere la sessione corrente
      const { data: { session }, error: getError } = await supabase.auth.getSession();
      
      if (getError) {
        console.error('[useAppLifecycle] getSession error:', getError);
        addBreadcrumb('session_check_error', { error: getError.message });
        
        // Tenta refresh esplicito
        const { error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('[useAppLifecycle] refreshSession failed:', refreshError);
          addBreadcrumb('session_refresh_failed', { error: refreshError.message });
          
          // Sessione irrecuperabile - logout pulito
          toast.error('Sessione scaduta. Effettua nuovamente il login.', {
            duration: 5000,
            action: {
              label: 'Login',
              onClick: () => window.location.href = '/auth'
            }
          });
          await signOut();
          return;
        }
      }
      
      // 2. Verifica validità token
      if (!session) {
        // Nessuna sessione - non è un errore se l'utente non era loggato
        if (user) {
          console.warn('[useAppLifecycle] Session lost while user was logged in');
          addBreadcrumb('session_lost');
          toast.error('Sessione scaduta. Effettua nuovamente il login.');
          await signOut();
        }
        return;
      }
      
      // 3. Check esplicito scadenza token
      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      const isExpired = expiresAt && expiresAt < now;
      const isExpiringSoon = expiresAt && (expiresAt - now) < 300; // < 5 minuti
      
      if (isExpired || isExpiringSoon) {
        console.log('[useAppLifecycle] Token expired or expiring soon, refreshing...');
        addBreadcrumb('session_token_refresh', { isExpired, expiresIn: expiresAt - now });
        
        const { error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('[useAppLifecycle] Token refresh failed:', refreshError);
          addBreadcrumb('session_refresh_failed', { error: refreshError.message });
          toast.error('Sessione scaduta. Effettua nuovamente il login.');
          await signOut();
          return;
        }
        
        addBreadcrumb('session_refreshed');
      }
      
      // 4. Sessione valida - riprendi mutations pausate e invalida query critiche
      addBreadcrumb('session_valid');
      
      // Resume any paused mutations
      await queryClient.resumePausedMutations();
      
      // Invalidate critical queries to get fresh data
      for (const key of CRITICAL_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      
      console.log('[useAppLifecycle] Session check complete, queries invalidated');
      addBreadcrumb('session_check_complete');
      
    } catch (error) {
      console.error('[useAppLifecycle] Unexpected error:', error);
      addBreadcrumb('session_check_unexpected_error', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    } finally {
      isCheckingSession.current = false;
    }
  }, [queryClient, user, signOut]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // App va in background - salva timestamp
        lastHiddenAt.current = Date.now();
        addBreadcrumb('app_hidden');
      } else if (document.visibilityState === 'visible') {
        // App torna in primo piano
        addBreadcrumb('app_visible');
        
        const hiddenDuration = lastHiddenAt.current 
          ? Date.now() - lastHiddenAt.current 
          : 0;
        
        console.log(`[useAppLifecycle] App resumed after ${Math.round(hiddenDuration / 1000)}s`);
        
        // Check sessione solo se:
        // 1. L'utente era loggato
        // 2. L'app è stata in background per almeno MIN_BACKGROUND_TIME_MS
        if (user && hiddenDuration >= MIN_BACKGROUND_TIME_MS) {
          addBreadcrumb('app_resume_check_session', { 
            hiddenDurationSec: Math.round(hiddenDuration / 1000) 
          });
          handleSessionCheck();
        }
        
        lastHiddenAt.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, handleSessionCheck]);

  // Export per uso manuale se necessario
  return { checkSession: handleSessionCheck };
}
```

### File 2: `src/components/AppLifecycleHandler.tsx` (NUOVO)

Componente wrapper che monta l'hook:

```typescript
import { useAppLifecycle } from '@/hooks/useAppLifecycle';

export function AppLifecycleHandler() {
  useAppLifecycle();
  return null;
}
```

### File 3: Modifica `src/App.tsx`

Aggiungere il componente dentro AuthProvider:

```typescript
// Import nuovo componente
import { AppLifecycleHandler } from "@/components/AppLifecycleHandler";

// Nel render, dopo ServiceWorkerNavigationHandler:
<AuthProvider>
  <TooltipProvider>
    <Sonner />
    <ServiceWorkerNavigationHandler />
    <AppLifecycleHandler />  {/* NUOVO */}
    <BrowserRouter>
      ...
    </BrowserRouter>
  </TooltipProvider>
</AuthProvider>
```

---

## Logica di Decisione

```text
visibilitychange → visible
        │
        ▼
  User loggato?  ──No──▶ NOOP
        │
       Yes
        │
        ▼
  Background > 30s?  ──No──▶ NOOP (refresh non necessario)
        │
       Yes
        │
        ▼
  getSession()
        │
        ├─ Error ──▶ refreshSession() ──▶ Fail? ──▶ Logout + Toast
        │                                    │
        │                                   OK ──▶ Continue
        │
        ├─ No session + user exists ──▶ Logout + Toast
        │
        └─ Session OK
                │
                ▼
          Token scaduto/scadente?
                │
                ├─ Yes ──▶ refreshSession() ──▶ Fail? ──▶ Logout
                │                                   │
                │                                  OK ──▶ Continue
                │
                └─ No
                     │
                     ▼
          ┌──────────────────────────────┐
          │ resumePausedMutations()      │
          │ invalidateQueries(critical)  │
          └──────────────────────────────┘
```

---

## Query Keys Invalidate

Le seguenti query vengono invalidate al resume:
- `posts` - Feed principale
- `current-profile` - Profilo utente
- `saved-posts` - Post salvati
- `notifications` - Notifiche
- `daily-focus` - Focus editoriale
- `message-threads` - Conversazioni messaggi

---

## Integrazione con Breadcrumbs

Il hook aggiunge breadcrumb per ogni evento significativo, facilitando il debug:
- `app_hidden` / `app_visible`
- `app_resume_check_session`
- `session_check_start` / `session_check_complete`
- `session_token_refresh` / `session_refreshed`
- `session_refresh_failed`
- `session_lost`

---

## Riepilogo Files

| File | Azione | Scopo |
|------|--------|-------|
| `src/hooks/useAppLifecycle.ts` | CREARE | Hook con logica session check |
| `src/components/AppLifecycleHandler.tsx` | CREARE | Componente wrapper |
| `src/App.tsx` | MODIFICARE | Montare AppLifecycleHandler |

---

## Considerazioni

### Perché 30 secondi di soglia?
- Un breve switch di tab non richiede refresh
- Supabase auto-refresh funziona per brevi pause
- 30s è un buon compromesso tra reattività e riduzione di chiamate inutili

### Perché invalidare invece di refetch?
- `invalidateQueries` marca le query come stale
- Il refetch avviene solo quando il componente che le usa è montato
- Evita fetch inutili per pagine non visualizzate

### Gestione offline?
- Se l'utente torna online dopo essere stato offline, il check potrebbe fallire temporaneamente
- Il toast con action button permette di ritentare manualmente

