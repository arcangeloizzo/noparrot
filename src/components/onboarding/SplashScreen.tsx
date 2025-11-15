import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { haptics } from "@/lib/haptics";

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // Phase 0: Giant logo centered with scale animation (2 seconds)
    // Phase 1: Logo reduces + wordmark appears simultaneously (800ms)
    // Phase 2: Combined element moves up + claim and button appear (600ms)

    const timer1 = setTimeout(() => setPhase(1), 2000);
    const timer2 = setTimeout(() => {
      setPhase(2);
      // Light haptic feedback at end of animation
      haptics.light();
    }, 2800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center px-6 text-foreground relative overflow-hidden">
      {/* Animated particles background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-primary/20 rounded-full animate-pulse" />
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-accent/30 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/3 left-1/3 w-3 h-3 bg-primary/10 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-primary/15 rounded-full animate-pulse" style={{ animationDelay: '3s' }} />
      </div>
      
      <div className="flex flex-col items-center justify-center relative z-10">
        {/* Combined Logo + Wordmark Container */}
        <div 
          className={`flex flex-col items-center transition-all ease-out relative ${
            phase >= 1 ? 'scale-50' : 'scale-[1.2]'
          } ${phase >= 2 ? '-translate-y-8' : 'translate-y-0'}`}
          style={{
            transitionDuration: phase === 0 ? '0ms' : '800ms',
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        >
          {/* Enhanced glow effect behind logo */}
          <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-3xl" 
               style={{ filter: 'blur(20px)', boxShadow: '0 0 60px rgba(10,122,255,0.3)' }} />
          
          {/* Logo with enhanced shadow */}
          <div style={{ filter: 'drop-shadow(0 0 20px rgba(10,122,255,0.3))' }}>
            <Logo id="introLogoMark" variant="icon" size="xl" className="w-96 h-auto relative z-10" />
          </div>
          
          {/* Wordmark with delay */}
          <div 
            className={`transition-all ease-out relative z-10 ${
              phase >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
            }`}
            style={{
              transitionDuration: '800ms',
              transitionDelay: phase >= 1 ? '300ms' : '0ms'
            }}
          >
            <div id="introWordmark" className="font-inter text-7xl font-semibold">
              <span className="bg-gradient-to-r from-accent to-accent/80 bg-clip-text text-transparent animate-pulse">NO</span>
              <span className="bg-gradient-to-r from-primary to-primary-blue bg-clip-text text-transparent animate-pulse" style={{ animationDelay: '0.5s' }}>PARROT</span>
            </div>
          </div>
        </div>

        {/* Claim and Button */}
        <div 
          id="introClaim"
          className={`transition-all duration-600 ease-out text-center space-y-6 mt-14 relative z-10 ${
            phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
          }`}
        >
          <div className="relative">
            <p className="text-lg text-muted-foreground font-medium mb-2">
              Leggi. 
              <span className="text-primary font-semibold"> Comprendi. </span>
              Poi condividi.
            </p>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent blur-sm" />
          </div>
          
          <Button 
            onClick={onComplete}
            className="bg-gradient-to-r from-primary to-primary-blue hover:scale-105 text-primary-foreground font-semibold px-8 py-3 rounded-full w-280 h-11 magnetic-hover glow-primary relative overflow-hidden group shadow-2xl"
          >
            <span className="relative z-10">Inizia il tuo viaggio</span>
            <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </Button>
        </div>
      </div>
    </div>
  );
};