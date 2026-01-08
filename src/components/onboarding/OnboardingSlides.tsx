import { useState, useRef, useEffect } from "react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { SlideToUnlock } from "./SlideToUnlock";
import { Lock, Check, PenLine, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingSlidesProps {
  onComplete: () => void;
}

export const OnboardingSlides = ({ onComplete }: OnboardingSlidesProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showCheck, setShowCheck] = useState(false);
  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);

  const nextSlide = () => {
    if (currentSlide < 3) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  // Auto-trigger Lock → Check animation on Slide 2
  useEffect(() => {
    if (currentSlide === 1) {
      const timer = setTimeout(() => setShowCheck(true), 1000);
      return () => clearTimeout(timer);
    } else {
      setShowCheck(false);
    }
  }, [currentSlide]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current || !touchEndRef.current) return;
    
    const distance = touchStartRef.current - touchEndRef.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    // Forward swipe: only on Slide 2 (index 1)
    if (isLeftSwipe && currentSlide === 1) {
      nextSlide();
    }
    
    // Back swipe: always allowed
    if (isRightSwipe && currentSlide > 0) {
      prevSlide();
    }
    
    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  // Slide 1: Il Nemico - Button navigation
  const SlideNemico = () => (
    <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
      {/* Logo grande - aspect ratio preserved */}
      <Logo variant="icon" size="xl" className="w-auto h-32 mb-12" />
      
      {/* Titolo */}
      <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-6">
        Non fare il pappagallo.
      </h1>
      
      {/* Sottotitolo */}
      <p className="text-base text-white/60 leading-relaxed max-w-sm">
        I social sono echi infiniti. Qui si condivide solo ciò che si è compreso. Spezza la catena.
      </p>
      
      {/* Button Continua */}
      <Button
        onClick={(e) => { e.stopPropagation(); nextSlide(); }}
        className="mt-12 px-8 bg-primary hover:bg-primary/90"
      >
        Continua
      </Button>
    </div>
  );

  // Slide 2: La Difesa - Swipe navigation
  const SlideDifesa = () => (
    <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
      {/* Icona animata Lock -> Check (auto-trigger) */}
      <div className="relative w-24 h-24 mb-12 flex items-center justify-center">
        <div className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-500",
          showCheck ? "opacity-0 scale-75" : "opacity-100 scale-100"
        )}>
          <Lock className="w-20 h-20 text-primary stroke-[1.5]" />
        </div>
        <div className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-500",
          showCheck ? "opacity-100 scale-100" : "opacity-0 scale-75"
        )}>
          <Check className="w-20 h-20 text-green-500 stroke-[1.5]" />
        </div>
      </div>
      
      {/* Titolo */}
      <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-6">
        Prima capisci. Poi posti.
      </h1>
      
      {/* Sottotitolo */}
      <p className="text-base text-white/60 leading-relaxed max-w-sm">
        Vuoi condividere un link? L'AI ti farà 3 domande. Se non hai letto o non hai capito, non passa. Nessuna eccezione.
      </p>
      
      {/* Swipe hint - più visibile */}
      <div className="mt-12 flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white/10 border border-white/20 animate-pulse">
        <span className="text-sm text-white/70 font-medium">Scorri per continuare</span>
        <span className="text-white/70">→</span>
      </div>
    </div>
  );

  // Slide 3: L'Autore - Tap icon navigation
  const SlideAutore = () => (
    <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
      {/* Icona penna + nebulosa stilizzata - TAPPABILE con bordo visibile */}
      <div 
        className="relative w-28 h-28 mb-12 flex items-center justify-center cursor-pointer 
                   hover:scale-110 active:scale-95 transition-transform duration-200
                   rounded-full bg-primary/10 border-2 border-primary/40"
        onClick={(e) => { e.stopPropagation(); nextSlide(); }}
      >
        <Sparkles className="absolute w-32 h-32 text-primary/30 stroke-[0.5] animate-pulse" />
        <PenLine className="w-14 h-14 text-primary stroke-[1.5]" />
        {/* Ring di feedback pulsante */}
        <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
      </div>
      
      {/* Titolo */}
      <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-6">
        Il tuo Diario Cognitivo.
      </h1>
      
      {/* Sottotitolo */}
      <p className="text-base text-white/60 leading-relaxed max-w-sm">
        Niente post usa e getta. Il tuo profilo è un blog personale dove ciò che scrivi e ciò che comprendi costruisce la tua identità. Lascia un segno, non solo rumore.
      </p>
      
      {/* Tap hint - più visibile */}
      <div className="mt-12 flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white/10 border border-white/20">
        <span className="text-sm text-white/70 font-medium">Tocca l'icona per continuare</span>
      </div>
    </div>
  );

  // Slide 4: Il Patto - SlideToUnlock navigation
  const SlidePatto = () => (
    <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
      {/* Titolo */}
      <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-6">
        NoParrot richiede tempo.
      </h1>
      
      {/* Sottotitolo */}
      <p className="text-base text-white/60 leading-relaxed max-w-sm mb-16">
        Stai scegliendo l'attrito al posto della comodità. Sei sicuro?
      </p>
      
      {/* Slider */}
      <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <SlideToUnlock onUnlock={onComplete} />
      </div>
    </div>
  );

  const slides = [SlideNemico, SlideDifesa, SlideAutore, SlidePatto];
  const CurrentSlideComponent = slides[currentSlide];

  return (
    <div 
      className="min-h-screen bg-[#0E141A] flex flex-col relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Dots indicator */}
      <div className="absolute top-8 left-0 right-0 flex justify-center gap-2 z-10 pt-safe">
        {slides.map((_, index) => (
          <div
            key={index}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              index === currentSlide 
                ? "bg-primary w-6" 
                : index < currentSlide 
                  ? "bg-primary/50" 
                  : "bg-white/20"
            )}
          />
        ))}
      </div>

      {/* Current slide */}
      <div className="flex-1 flex flex-col pt-16 pb-8">
        <CurrentSlideComponent />
      </div>
    </div>
  );
};
