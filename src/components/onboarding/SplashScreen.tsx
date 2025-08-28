import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // Phase 0: Initial state
    // Phase 1: Logo scales and moves up (900ms)
    // Phase 2: Wordmark appears with fade and slide-up (700ms) 
    // Phase 3: Both shift up, reveal claim and button (500ms delay)

    const timer1 = setTimeout(() => setPhase(1), 100);
    const timer2 = setTimeout(() => setPhase(2), 1000);
    const timer3 = setTimeout(() => setPhase(3), 2200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-blue to-dark-blue/80 flex flex-col items-center justify-center px-6 text-white">
      <div className="flex flex-col items-center space-y-6">
        {/* Logo Container */}
        <div 
          className={`transition-transform duration-[900ms] ease-in-out ${
            phase >= 1 ? 'transform scale-[0.55] -translate-y-10' : ''
          } ${phase >= 3 ? '-translate-y-16' : ''}`}
        >
          <Logo id="introLogoMark" variant="icon" size="xl" className="w-24 h-24" />
        </div>

        {/* Wordmark */}
        <div 
          className={`transition-all duration-700 ease-out ${
            phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
          } ${phase >= 3 ? '-translate-y-8' : ''}`}
        >
          <div id="introWordmark" className="font-inter text-3xl font-semibold">
            <span style={{ color: '#bbe6e4' }}>NO</span>
            <span style={{ color: '#0a77ed' }}>PARROT</span>
          </div>
        </div>

        {/* Claim and Button */}
        <div 
          id="introClaim"
          className={`transition-all duration-500 ease-out text-center space-y-6 ${
            phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
          }`}
        >
          <p className="text-lg text-light-blue/90 font-medium">
            Read. Understand. Then share.
          </p>
          
          <Button 
            onClick={onComplete}
            className="bg-primary-blue hover:bg-primary-blue/90 text-white font-semibold px-8 py-3 rounded-full w-280 h-11"
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
};