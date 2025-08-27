import { useState, useEffect } from "react";
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

  return <Feed />;
};

export default Index;
