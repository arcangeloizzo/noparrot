import { useState, useEffect } from "react";
import { SplashScreen } from "@/components/onboarding/SplashScreen";
import { OnboardingSlides } from "@/components/onboarding/OnboardingSlides";
import { AuthPage } from "@/components/auth/AuthPage";
import ConsentScreen from "@/pages/ConsentScreen";

interface OnboardingFlowProps {
  onComplete: () => void;
}

type OnboardingStep = "splash" | "slides" | "consent" | "auth";

// Reset consent flag to ensure ConsentScreen is always shown during onboarding
const resetConsentFlag = () => {
  localStorage.removeItem("noparrot-consent-completed");
};

export const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("splash");

  // Reset consent flag when onboarding starts
  useEffect(() => {
    resetConsentFlag();
  }, []);

  const handleSplashComplete = () => {
    setCurrentStep("slides");
  };

  const handleSlidesComplete = () => {
    // Always show consent screen during onboarding
    setCurrentStep("consent");
  };

  const handleConsentComplete = () => {
    setCurrentStep("auth");
  };

  switch (currentStep) {
    case "splash":
      return <SplashScreen onComplete={handleSplashComplete} />;
    
    case "slides":
      return (
        <OnboardingSlides 
          onComplete={handleSlidesComplete}
        />
      );
    
    case "consent":
      return <ConsentScreen onComplete={handleConsentComplete} />;
    
    case "auth":
      return <AuthPage initialMode="signup" />;
    
    default:
      return null;
  }
};

export default OnboardingFlow;
