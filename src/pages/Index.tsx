import { useState, useEffect } from "react";
import { CGProvider } from "@/lib/comprehension-gate";
import { OnboardingFlow } from "./OnboardingFlow";
import { Feed } from "./Feed";
import { AuthPage } from "@/components/auth/AuthPage";
import { useAuth } from "@/contexts/AuthContext";
import { isConsentCompleted } from "@/hooks/useUserConsents";
import ConsentScreen from "./ConsentScreen";

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
  }, []);

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
