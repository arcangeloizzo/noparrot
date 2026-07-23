import { useState, useEffect } from "react";
import { SplashScreen } from "@/components/onboarding/SplashScreen";
import { OnboardingFeed } from "@/components/onboarding/OnboardingFeed";
import { AuthPage } from "@/components/auth/AuthPage";
import { DemoGateFlow } from "@/pages/DemoGateFlow";

interface OnboardingFlowProps {
  onComplete: () => void;
}

type OnboardingStep = "splash" | "slides" | "demo" | "auth";

export const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("splash");
  const [demoChoice, setDemoChoice] = useState<"article" | "song" | null>(null);

  // Consent now lives inside AuthPage step 3 — reset the legacy flag so any
  // downstream code that still checks it does not skip the new step.
  useEffect(() => {
    localStorage.removeItem("noparrot-consent-completed");
  }, []);

  const handleSplashComplete = () => {
    setCurrentStep("slides");
  };

  const handleDemoComplete = () => {
    // Both success and skip lead directly to auth. Consent is collected as
    // Step 3 of the registration inside AuthPage.
    setCurrentStep("auth");
  };

  switch (currentStep) {
    case "splash":
      return <SplashScreen onComplete={handleSplashComplete} />;

    case "slides":
      return (
        <OnboardingFeed
          onComplete={() => setCurrentStep("auth")}
          onSkip={() => setCurrentStep("auth")}
          onStartDemo={(choice) => {
            setDemoChoice(choice);
            setCurrentStep("demo");
          }}
        />
      );
      
    case "demo":
      return (
        <DemoGateFlow
          initialChoice={demoChoice ?? "article"}
          onComplete={handleDemoComplete}
          onSkip={handleDemoComplete}
        />
      );
    
    case "auth":
      return <AuthPage initialMode="signup" />;
    
    default:
      return null;
  }
};

export default OnboardingFlow;
