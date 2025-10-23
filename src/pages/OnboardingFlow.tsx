import { useState, useEffect } from "react";
import { SplashScreen } from "@/components/onboarding/SplashScreen";
import { OnboardingSlides } from "@/components/onboarding/OnboardingSlides";
import { MissionPage } from "@/components/onboarding/MissionPage";
import { AuthPage } from "@/components/auth/AuthPage";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState<"splash" | "slides" | "mission" | "auth">("splash");

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
    setCurrentStep("auth");
  };

  const handleLogin = () => {
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

  if (currentStep === "auth") {
    return <AuthPage />;
  }

  return null;
};