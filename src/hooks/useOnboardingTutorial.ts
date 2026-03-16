import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";

export type TutorialStep = "il-punto" | "feed" | "composer" | "profile-nav" | "nebulosa" | "final" | null;

export const STEPS: TutorialStep[] = [
  "il-punto",
  "feed",
  "composer",
  "profile-nav",
  "nebulosa",
  "final"
];

export const useOnboardingTutorial = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeStep, setActiveStep] = useState<TutorialStep>(null);
  const [hasDismissed, setHasDismissed] = useState<boolean>(true); // Default to true while checking
  const [isLoading, setIsLoading] = useState(true);

  // Poll for the target element to measure its DOM rect
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Fetch initial state from profile
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const checkTutorialState = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("has_dismissed_tutorial")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error fetching tutorial state:", error);
          setHasDismissed(true); // Failsafe, don't show tutorial
        } else {
          const dismissed = data?.has_dismissed_tutorial ?? false;
          setHasDismissed(dismissed);
          if (!dismissed) {
             setActiveStep(STEPS[0]);
             // Ensure we are on home for first steps
             if (location.pathname !== '/') {
                navigate('/');
             }
          }
        }
      } catch (err) {
         setHasDismissed(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkTutorialState();
  }, [user]);

  // Handle cross-page navigation logic for steps
  useEffect(() => {
    if (hasDismissed || isLoading || !activeStep) return;

    if ((activeStep === "il-punto" || activeStep === "feed" || activeStep === "composer" || activeStep === "profile-nav") && location.pathname !== '/') {
      navigate('/');
    } else if (activeStep === "nebulosa" && location.pathname !== '/profile') {
      navigate('/profile');
    }
  }, [activeStep, location.pathname, hasDismissed, isLoading, navigate]);

  const nextStep = useCallback(() => {
    if (!activeStep) return;
    const currentIndex = STEPS.indexOf(activeStep);
    if (currentIndex < STEPS.length - 1) {
      setActiveStep(STEPS[currentIndex + 1]);
    } else {
      setActiveStep(null);
    }
  }, [activeStep]);

  const dismissTutorial = useCallback(async (permanently: boolean) => {
    setActiveStep(null);
    if (permanently && user) {
      setHasDismissed(true);
      try {
        await supabase
          .from("profiles")
          .update({ has_dismissed_tutorial: true })
          .eq("id", user.id);
      } catch (err) {
        console.error("Failed to dismiss tutorial:", err);
      }
    }
  }, [user]);

  const resetTutorial = useCallback(async () => {
    if (!user) return;
    try {
      await supabase
        .from("profiles")
        .update({ has_dismissed_tutorial: false })
        .eq("id", user.id);
      setHasDismissed(false);
      setActiveStep("il-punto");
      navigate('/');
    } catch (err) {
      console.error("Failed to reset tutorial:", err);
    }
  }, [user, navigate]);

  // Observer/Polling for target DOM coordinates
  useEffect(() => {
    if (!activeStep || activeStep === "final" || hasDismissed) {
      setTargetRect(null);
      return;
    }

    let rafId: number;

    const updateRect = () => {
      const el = document.querySelector(`[data-tutorial="${activeStep}"]`);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
      rafId = requestAnimationFrame(updateRect);
    };

    updateRect();

    // Re-measure on resize or scroll
    const handleScrollResize = () => {
      const el = document.querySelector(`[data-tutorial="${activeStep}"]`);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      }
    };

    window.addEventListener("resize", handleScrollResize);
    window.addEventListener("scroll", handleScrollResize, true); // true for capture, useful in deeply nested scroll areas

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleScrollResize);
      window.removeEventListener("scroll", handleScrollResize, true);
    };
  }, [activeStep, hasDismissed]);

  return {
    activeStep,
    targetRect,
    nextStep,
    dismissTutorial,
    resetTutorial,
    isTutorialActive: !hasDismissed && !isLoading && activeStep !== null,
    stepIndex: activeStep ? STEPS.indexOf(activeStep) : -1,
    totalSteps: STEPS.length
  };
};
