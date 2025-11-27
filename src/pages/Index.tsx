import { useState, useEffect } from "react";
import { CGProvider } from "@/lib/comprehension-gate";
import { OnboardingFlow } from "./OnboardingFlow";
import { Feed } from "./Feed";
import { AuthPage } from "@/components/auth/AuthPage";
import { useAuth } from "@/contexts/AuthContext";
import { WelcomeRitualScreen } from "@/components/onboarding/WelcomeRitualScreen";

const Index = () => {
  const { user, loading } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  
  // Usa sessionStorage per tracciare se l'utente ha già "entrato" nella sessione corrente
  const [hasEnteredSession, setHasEnteredSession] = useState(() => {
    return sessionStorage.getItem('noparrot-session-entered') === 'true';
  });
  
  // Flag per forzare il Welcome Screen (da feed refresh/home)
  const [forceWelcome, setForceWelcome] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('noparrot-onboarding-completed');
    setHasSeenOnboarding(!!seen);

    // Controlla se siamo in modalità password recovery
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    if (type === 'recovery') {
      setIsPasswordRecovery(true);
    }
    
    // Controlla se c'è un flag per mostrare il Welcome Screen
    const showWelcome = sessionStorage.getItem('noparrot-show-welcome');
    if (showWelcome === 'true') {
      setForceWelcome(true);
      setHasEnteredSession(false);
      sessionStorage.removeItem('noparrot-show-welcome');
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('noparrot-onboarding-completed', 'true');
    setHasSeenOnboarding(true);
  };
  
  const handleEnterSession = () => {
    sessionStorage.setItem('noparrot-session-entered', 'true');
    setHasEnteredSession(true);
    setForceWelcome(false);
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

  // Non autenticato E ha già visto onboarding → mostra solo login
  if (!user && hasSeenOnboarding) {
    return <AuthPage />;
  }

  // Non autenticato E non ha visto onboarding → mostra onboarding
  if (!user) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  // Autenticato ma non ha ancora "entrato" OPPURE forceWelcome → mostra Welcome Screen
  if (!hasEnteredSession || forceWelcome) {
    return (
      <WelcomeRitualScreen 
        onEnter={handleEnterSession}
      />
    );
  }

  // Autenticato e ha "entrato" → mostra feed
  return (
    <CGProvider policy={{ minReadSeconds: 10, minScrollRatio: 0.8, passingRule: ">=2_of_3" }}>
      <Feed />
    </CGProvider>
  );
};

export default Index;
