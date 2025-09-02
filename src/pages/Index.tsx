import { useState, useEffect } from "react";
import { CGProvider } from "@/lib/comprehension-gate";
import { OnboardingFlow } from "./OnboardingFlow";
import { Feed } from "./Feed";

const Index = () => {
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    // Check if user has completed onboarding
    const hasOnboarded = localStorage.getItem("noparrot-onboarded");
    if (hasOnboarded) {
      setIsOnboarded(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem("noparrot-onboarded", "true");
    setIsOnboarded(true);
  };

  if (!isOnboarded) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return (
    <CGProvider policy={{ minReadSeconds: 10, minScrollRatio: 0.8, passingRule: ">=2_of_3" }}>
      <Feed />
    </CGProvider>
  );
};

export default Index;
