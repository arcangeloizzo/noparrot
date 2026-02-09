import { useState, useEffect } from "react";
import { CGProvider } from "@/lib/comprehension-gate";
// import { OnboardingFlow } from "./OnboardingFlow";
import { Feed } from "./Feed";
import { AuthPage } from "@/components/auth/AuthPage";
import { useAuth } from "@/contexts/AuthContext";
import { isConsentCompleted } from "@/hooks/useUserConsents";
import ConsentScreen from "./ConsentScreen";
import { cleanupStaleScrollLocks } from "@/lib/bodyScrollLock";
import { checkForRecentCrash, clearBreadcrumbs, addBreadcrumb, clearPendingPublish, getPendingPublish, installSystemEventTrackers } from "@/lib/crashBreadcrumbs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
// Stable policy object - prevents CGProvider re-renders
const FEED_POLICY = {
  minReadSeconds: 10,
  minScrollRatio: 0.8,
  passingRule: ">=2_of_3"
} as const;

const Index = () => {
  const { user, loading } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [hasCompletedConsent, setHasCompletedConsent] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('noparrot-onboarding-completed');
    setHasSeenOnboarding(!!seen);
    setHasCompletedConsent(isConsentCompleted());

    // Controlla se siamo in modalità password recovery
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    if (type === 'recovery') {
      setIsPasswordRecovery(true);
    }

    // iOS crash recovery: cleanup stale scroll locks from previous session
    const hadStaleLock = cleanupStaleScrollLocks();

    // Check for recent crash + breadcrumbs
    const { crashed, breadcrumbs } = checkForRecentCrash();

    if (crashed && breadcrumbs.length > 0) {
      console.warn('[Index] Detected recent crash, breadcrumbs:', breadcrumbs);
      const last = breadcrumbs[breadcrumbs.length - 1];
      const lastEvent = last?.event || '(non disponibile)';

      // SESSION GUARD: Suppress false positives more aggressively
      // Only show "Sessione precedente interrotta" if there's HIGH CONFIDENCE of a real problem:
      // 1. Stale scroll lock (body was locked, indicating interrupted modal/overlay)
      // 2. Pending publish that didn't complete (publish_started or quiz_passed)
      // 3. Actual error events (not system events like visibility changes)
      const isSystemEvent = lastEvent.startsWith('sys_') ||
        lastEvent === 'app_hidden' ||
        lastEvent === 'app_visible' ||
        lastEvent === 'session_guard_' ||
        lastEvent.startsWith('session_');
      const hasPendingPublish = localStorage.getItem('publish_flow_step') === 'publish_started' ||
        localStorage.getItem('publish_flow_step') === 'quiz_passed';
      const hasRealProblem = hadStaleLock || hasPendingPublish;

      // Detect legitimate share navigation (quiz completed + navigation to composer)
      // This prevents false positives when resharing from /post/:id
      const lastEvents = breadcrumbs.slice(-5).map(b => b.event);
      const isLegitimateShareNavigation =
        lastEvents.includes('quiz_closed') &&
        lastEvents.includes('share_navigation_to_composer');

      // Only show toast if there's a high-confidence real problem AND it's not a legitimate navigation
      if (hasRealProblem && !isSystemEvent && !isLegitimateShareNavigation) {
        toast.info(`Sessione precedente interrotta. Ultimo evento: ${lastEvent}.`, { duration: 5000 });
      }
      // Log last 5 breadcrumbs for diagnostics (always, for debugging)
      console.log('[Index] Last 5 breadcrumbs before crash:', breadcrumbs.slice(-5));
    }

    // Check localStorage publish flow markers for incomplete publishes
    const publishStep = localStorage.getItem('publish_flow_step');
    const publishAt = localStorage.getItem('publish_flow_at');
    if (publishStep && publishAt) {
      const age = Date.now() - parseInt(publishAt, 10);
      if (age < 5 * 60 * 1000) { // entro 5 minuti
        if (publishStep === 'quiz_passed') {
          // Quiz was passed but publish didn't complete - offer recovery
          console.warn('[Index] Quiz passed but publish incomplete, offering recovery');
          addBreadcrumb('recovery_quiz_passed_detected');
          // Don't clear markers yet - the second useEffect will handle recovery with pending publish
        } else if (publishStep === 'publish_started') {
          console.warn('[Index] Publish started but incomplete');
          toast.warning('Pubblicazione interrotta. Riprova.', { duration: 4000 });
          // Clear markers for publish_started (no recovery possible without idempotency)
          localStorage.removeItem('publish_flow_step');
          localStorage.removeItem('publish_flow_at');
        }
      } else {
        // Old markers, just clear
        localStorage.removeItem('publish_flow_step');
        localStorage.removeItem('publish_flow_at');
      }
    }

    // Install system-level event trackers (pagehide, visibilitychange) for diagnosing silent reloads
    installSystemEventTrackers();

    // Clear old breadcrumbs and start fresh
    clearBreadcrumbs();
    addBreadcrumb('app_init', { hadStaleLock, crashed });
  }, []);

  // Check pending publish and verify on backend - offer recovery if quiz was passed
  useEffect(() => {
    if (loading || !user) return;

    const pending = getPendingPublish();
    const publishStep = localStorage.getItem('publish_flow_step');

    if (!pending) {
      // No pending publish data - clear any stale markers
      if (publishStep) {
        localStorage.removeItem('publish_flow_step');
        localStorage.removeItem('publish_flow_at');
      }
      return;
    }

    const isRecent = pending.timestamp > Date.now() - 10 * 60 * 1000;
    if (!isRecent) {
      // Old pending, silently clear
      clearPendingPublish();
      localStorage.removeItem('publish_flow_step');
      localStorage.removeItem('publish_flow_at');
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from('publish_idempotency')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('key', pending.idempotencyKey)
          .maybeSingle();

        if (error) {
          console.warn('[Index] publish_idempotency check failed', error);
          clearPendingPublish();
          localStorage.removeItem('publish_flow_step');
          localStorage.removeItem('publish_flow_at');
          return;
        }

        if (data?.post_id) {
          // Post was actually published before crash - confirm to user
          toast.success('Post pubblicato.', { duration: 3500 });
          clearPendingPublish();
          localStorage.removeItem('publish_flow_step');
          localStorage.removeItem('publish_flow_at');
        } else if (publishStep === 'quiz_passed') {
          // Quiz passed but publish didn't complete - offer recovery action
          addBreadcrumb('recovery_offer_retry');
          toast.info('Pubblicazione interrotta dopo il quiz.', {
            duration: 10000,
            action: {
              label: 'Riprova',
              onClick: async () => {
                addBreadcrumb('recovery_retry_clicked');
                const retryToast = toast.loading('Ripristino pubblicazione…');
                try {
                  // Retry publish via edge function with same idempotency key
                  const { data: retryData, error: retryError } = await supabase.functions.invoke('publish-post', {
                    body: {
                      content: pending.content,
                      sharedUrl: pending.sharedUrl,
                      quotedPostId: pending.quotedPostId,
                      mediaIds: pending.mediaIds,
                      idempotencyKey: pending.idempotencyKey,
                    },
                  });

                  toast.dismiss(retryToast);

                  if (retryError) {
                    console.error('[Index] Recovery publish error:', retryError);
                    addBreadcrumb('recovery_publish_error', { error: String(retryError) });
                    toast.error('Errore durante il recupero. Riprova manualmente.');
                  } else {
                    const wasIdempotent = (retryData as any)?.idempotent === true;
                    addBreadcrumb('recovery_publish_success', { postId: (retryData as any)?.postId, wasIdempotent });
                    toast.success(wasIdempotent ? 'Post già pubblicato.' : 'Post pubblicato.');
                  }
                } catch (e) {
                  toast.dismiss(retryToast);
                  console.error('[Index] Recovery catch:', e);
                  addBreadcrumb('recovery_catch', { error: String(e) });
                  toast.error('Errore durante il recupero.');
                } finally {
                  clearPendingPublish();
                  localStorage.removeItem('publish_flow_step');
                  localStorage.removeItem('publish_flow_at');
                }
              }
            }
          });
        } else {
          // Not published and not quiz_passed - silently clear
          console.log('[Index] Pending publish not completed, clearing silently');
          clearPendingPublish();
          localStorage.removeItem('publish_flow_step');
          localStorage.removeItem('publish_flow_at');
        }
      } catch (e) {
        console.warn('[Index] pending publish verify error', e);
        clearPendingPublish();
        localStorage.removeItem('publish_flow_step');
        localStorage.removeItem('publish_flow_at');
      }
    })();
  }, [loading, user]);

  const handleOnboardingComplete = () => {
    localStorage.setItem('noparrot-onboarding-completed', 'true');
    setHasSeenOnboarding(true);
  };

  const handleConsentComplete = () => {
    setHasCompletedConsent(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  // Password recovery ha priorità su tutto
  if (isPasswordRecovery) {
    return <AuthPage forcePasswordReset={true} />;
  }

  // Non autenticato E ha già visto onboarding
  if (!user && hasSeenOnboarding) {
    // Check if consent is completed
    if (!hasCompletedConsent) {
      return <ConsentScreen onComplete={handleConsentComplete} />;
    }
    return <AuthPage />;
  }

  // Non autenticato E non ha visto onboarding → mostra onboarding
  if (!user) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  // Autenticato → mostra feed
  return (
    <CGProvider policy={FEED_POLICY}>
      {/* <div className="p-10 text-white">FEED DISABLED</div> */}
      <Feed />
    </CGProvider>
  );
};

export default Index;
