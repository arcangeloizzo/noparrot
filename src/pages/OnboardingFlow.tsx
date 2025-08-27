import { useState } from "react";
import { SplashScreen } from "@/components/onboarding/SplashScreen";
import { MissionPage } from "@/components/onboarding/MissionPage";
import { AuthPage } from "@/components/auth/AuthPage";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState<"splash" | "mission" | "auth">("splash");
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");

  const handleSplashComplete = () => {
    setCurrentStep("mission");
  };

  const handleCreateAccount = () => {
    setAuthMode("signup");
    setCurrentStep("auth");
  };

  const handleLogin = () => {
    setAuthMode("login");
    setCurrentStep("auth");
  };

  const handleAuthSubmit = (email: string, password: string) => {
    // In a real app, this would handle authentication
    console.log("Auth submitted:", { email, password, mode: authMode });
    onComplete();
  };

  const handleBack = () => {
    if (currentStep === "auth") {
      setCurrentStep("mission");
    }
  };

  const handleToggleAuthMode = () => {
    setAuthMode(authMode === "login" ? "signup" : "login");
  };

  if (currentStep === "splash") {
    return <SplashScreen onComplete={handleSplashComplete} />;
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
    return (
      <AuthPage 
        mode={authMode}
        onSubmit={handleAuthSubmit}
        onBack={handleBack}
        onToggleMode={handleToggleAuthMode}
      />
    );
  }

  return null;
};