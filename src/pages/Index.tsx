import { useState, useEffect } from "react";
import { CGProvider } from "@/lib/comprehension-gate";
import { OnboardingFlow } from "./OnboardingFlow";
import { Feed } from "./Feed";
import { AuthPage } from "@/components/auth/AuthPage";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user, loading } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('noparrot-onboarding-seen');
    setHasSeenOnboarding(!!seen);
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('noparrot-onboarding-seen', 'true');
    setHasSeenOnboarding(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  // Non autenticato E ha già visto onboarding → mostra solo login
  if (!user && hasSeenOnboarding) {
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
