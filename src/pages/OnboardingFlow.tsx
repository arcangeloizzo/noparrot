import { useState } from "react";
import { SplashScreen } from "@/components/onboarding/SplashScreen";
import { OnboardingSlides } from "@/components/onboarding/OnboardingSlides";
import { ReadyScreen } from "@/components/onboarding/ReadyScreen";
import { AuthPage } from "@/components/auth/AuthPage";
import ConsentScreen from "@/pages/ConsentScreen";
import { isConsentCompleted } from "@/hooks/useUserConsents";

interface OnboardingFlowProps {
  onComplete: () => void;
}

type OnboardingStep = "splash" | "slides" | "ready" | "consent" | "auth";

export const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("splash");
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');

  const handleSplashComplete = () => {
    setCurrentStep("slides");
  };

  const handleSlidesComplete = () => {
    setCurrentStep("ready");
  };

  const handleSlidesSkip = () => {
    setCurrentStep("ready");
  };

  const handleEnter = () => {
    // Check if consent is already completed
    if (isConsentCompleted()) {
      setCurrentStep("auth");
    } else {
      setCurrentStep("consent");
    }
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
          onSkip={handleSlidesSkip}
        />
      );
    
    case "ready":
      return <ReadyScreen onEnter={handleEnter} />;
    
    case "consent":
      return <ConsentScreen onComplete={handleConsentComplete} />;
    
    case "auth":
      return <AuthPage initialMode={authMode} />;
    
    default:
      return null;
  }
};
