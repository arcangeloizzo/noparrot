import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // Phase 0: Giant logo centered (2 seconds)
    // Phase 1: Logo reduces + wordmark appears simultaneously (800ms)
    // Phase 2: Combined element moves up + claim and button appear (600ms)

    const timer1 = setTimeout(() => setPhase(1), 2000);
    const timer2 = setTimeout(() => setPhase(2), 2800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-blue to-dark-blue/80 flex items-center justify-center px-6 text-white">
      <div className="flex flex-col items-center justify-center">
        {/* Combined Logo + Wordmark Container */}
        <div 
          className={`flex flex-col items-center transition-all duration-800 ease-in-out ${
            phase >= 1 ? 'scale-50' : 'scale-100'
          } ${phase >= 2 ? '-translate-y-8' : 'translate-y-0'}`}
        >
          {/* Logo */}
          <Logo id="introLogoMark" variant="icon" size="xl" className="w-96 h-96" />
          
          {/* Wordmark */}
          <div 
            className={`transition-all duration-800 ease-out ${
              phase >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
            }`}
          >
            <div id="introWordmark" className="font-inter text-7xl font-semibold">
              <span style={{ color: '#bbe6e4' }}>NO</span>
              <span style={{ color: '#0a77ed' }}>PARROT</span>
            </div>
          </div>
        </div>

        {/* Claim and Button */}
        <div 
          id="introClaim"
          className={`transition-all duration-600 ease-out text-center space-y-4 mt-14 ${
            phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
          }`}
        >
          <p className="text-lg text-light-blue/90 font-medium">
            Leggi. Comprendi. Poi condividi.
          </p>
          
          <Button 
            onClick={onComplete}
            className="bg-primary-blue hover:bg-primary-blue/90 text-white font-semibold px-8 py-3 rounded-full w-280 h-11"
          >
            Inizia
          </Button>
        </div>
      </div>
    </div>
  );
};