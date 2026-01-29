import { useEffect, useState } from "react";
import { LogoVertical } from "@/components/ui/LogoVertical";

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // Phase 0: Logo fade in (1.5s)
    // Phase 1: Wordmark appears (1s)
    // Phase 2: Auto-advance to next screen (1s delay)

    const timer1 = setTimeout(() => setPhase(1), 1500);
    const timer2 = setTimeout(() => setPhase(2), 2500);
    const timer3 = setTimeout(() => onComplete(), 3500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <div className={`min-h-screen bg-[#0E141A] flex items-center justify-center px-6 transition-opacity duration-500 ${phase >= 2 ? 'opacity-0' : 'opacity-100'}`}>
      <div className="flex flex-col items-center justify-center">
        {/* Logo Container */}
        <div 
          className={`flex flex-col items-center transition-all duration-700 ease-out ${
            phase >= 1 ? 'scale-90 -translate-y-4' : 'scale-100'
          }`}
        >
          {/* Parrot Icon Only */}
          <div 
            className={`transition-opacity duration-700 ease-out ${
              phase >= 0 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <LogoVertical hideText={true} className="w-32 h-32" />
          </div>
          
          {/* Wordmark - NO (blue) + PARROT (white) */}
          <div 
            className={`mt-6 transition-all duration-500 ease-out ${
              phase >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <h1 className="font-inter text-4xl font-bold tracking-wider">
              <span className="text-[#2465d2]">NO</span>
              <span className="text-white">PARROT</span>
            </h1>
          </div>
        </div>
      </div>
    </div>
  );
};
