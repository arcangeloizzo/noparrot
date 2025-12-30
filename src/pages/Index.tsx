import { useState, useEffect } from "react";
import { CGProvider } from "@/lib/comprehension-gate";
import { OnboardingFlow } from "./OnboardingFlow";
import { Feed } from "./Feed";
import { AuthPage } from "@/components/auth/AuthPage";
import { useAuth } from "@/contexts/AuthContext";
import { isConsentCompleted } from "@/hooks/useUserConsents";
import ConsentScreen from "./ConsentScreen";
import { cleanupStaleScrollLocks } from "@/lib/bodyScrollLock";
import { checkForRecentCrash, clearBreadcrumbs, addBreadcrumb, clearPendingPublish, getPendingPublish } from "@/lib/crashBreadcrumbs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
      const lastEvent = last?.event || 'unknown';
      toast.info(`Sessione precedente interrotta. Ultimo evento: ${lastEvent}.`, { duration: 4000 });
      console.log('[Index] Last 5 breadcrumbs before crash:', breadcrumbs.slice(-5));
    }

    // Clear old breadcrumbs and start fresh
    clearBreadcrumbs();
    addBreadcrumb('app_init', { hadStaleLock, crashed });
  }, []);

  // Check pending publish and verify on backend - only show success, never false negatives
  useEffect(() => {
    if (loading || !user) return;

    const pending = getPendingPublish();
    if (!pending) return;

    const isRecent = pending.timestamp > Date.now() - 10 * 60 * 1000;
    if (!isRecent) {
      // Old pending, silently clear
      clearPendingPublish();
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
          // Don't show error toast - user can just retry manually
          clearPendingPublish();
          return;
        }

        if (data?.post_id) {
          // Post was actually published before crash - confirm to user
          toast.success('Post pubblicato.', { duration: 3500 });
          clearPendingPublish();
        } else {
          // Not published but don't annoy user with error toast
          // Just clear the stale pending entry - they can retry if needed
          console.log('[Index] Pending publish not completed, clearing silently');
          clearPendingPublish();
        }
      } catch (e) {
        console.warn('[Index] pending publish verify error', e);
        clearPendingPublish();
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
    <CGProvider policy={{ minReadSeconds: 10, minScrollRatio: 0.8, passingRule: ">=2_of_3" }}>
      <Feed />
    </CGProvider>
  );
};

export default Index;
