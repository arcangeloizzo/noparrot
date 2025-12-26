import { useState, useEffect } from "react";
import { SplashScreen } from "@/components/onboarding/SplashScreen";
import { OnboardingSlides } from "@/components/onboarding/OnboardingSlides";
import { MissionPage } from "@/components/onboarding/MissionPage";
import { AuthPage } from "@/components/auth/AuthPage";
import ConsentScreen from "@/pages/ConsentScreen";
import { isConsentCompleted } from "@/hooks/useUserConsents";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState<"splash" | "slides" | "mission" | "consent" | "auth">("splash");
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const handleSplashComplete = () => {
    setCurrentStep("slides");
  };

  const handleSlidesComplete = () => {
    setCurrentStep("mission");
  };

  const handleSlidesSkip = () => {
    setCurrentStep("mission");
  };

  const handleCreateAccount = () => {
    // Check if consent is already completed
    if (isConsentCompleted()) {
      setAuthMode('signup');
      setCurrentStep("auth");
    } else {
      setAuthMode('signup');
      setCurrentStep("consent");
    }
  };

  const handleLogin = () => {
    // Check if consent is already completed
    if (isConsentCompleted()) {
      setAuthMode('login');
      setCurrentStep("auth");
    } else {
      setAuthMode('login');
      setCurrentStep("consent");
    }
  };

  const handleConsentComplete = () => {
    setCurrentStep("auth");
  };

  if (currentStep === "splash") {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (currentStep === "slides") {
    return (
      <OnboardingSlides 
        onComplete={handleSlidesComplete}
        onSkip={handleSlidesSkip}
      />
    );
  }

  if (currentStep === "mission") {
    return (
      <MissionPage 
        onCreateAccount={handleCreateAccount}
        onLogin={handleLogin}
      />
    );
  }

  if (currentStep === "consent") {
    return <ConsentScreen onComplete={handleConsentComplete} />;
  }

  if (currentStep === "auth") {
    return <AuthPage initialMode={authMode} />;
  }

  return null;
};
