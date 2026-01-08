import { useState } from "react";
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

  const nextSlide = () => {
    if (currentSlide < 3) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  // Slide 1: Il Nemico
  const SlideNemico = () => (
    <div className="flex flex-col items-center justify-center flex-1 px-8 pt-16 pb-20 text-center">
      {/* Logo grande */}
      <Logo variant="icon" size="xl" className="w-32 h-32 mb-12" />
      
      {/* Titolo */}
      <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-6">
        Non fare il pappagallo.
      </h1>
      
      {/* Sottotitolo */}
      <p className="text-base text-white/60 leading-relaxed max-w-sm">
        I social sono echi infiniti. Qui si condivide solo ciò che si è compreso. Spezza la catena.
      </p>
      
      {/* Hint swipe */}
      <p className="mt-auto text-xs text-white/30 animate-pulse">
        Scorri o tocca per continuare →
      </p>
    </div>
  );

  // Slide 2: La Difesa
  const SlideDifesa = () => (
    <div className="flex flex-col items-center justify-center flex-1 px-8 pt-16 pb-20 text-center">
      {/* Icona animata Lock -> Check */}
      <div 
        className="relative w-24 h-24 mb-12 flex items-center justify-center"
        onMouseEnter={() => setShowCheck(true)}
        onMouseLeave={() => setShowCheck(false)}
      >
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
      
      {/* Button */}
      <Button
        onClick={nextSlide}
        className="mt-12 px-8 bg-primary hover:bg-primary/90"
      >
        Continua
      </Button>
    </div>
  );

  // Slide 3: L'Autore
  const SlideAutore = () => (
    <div className="flex flex-col items-center justify-center flex-1 px-8 pt-16 pb-20 text-center">
      {/* Icona penna + nebulosa stilizzata */}
      <div className="relative w-24 h-24 mb-12 flex items-center justify-center">
        <Sparkles className="absolute w-28 h-28 text-primary/20 stroke-[0.5]" />
        <PenLine className="w-16 h-16 text-primary stroke-[1.5]" />
      </div>
      
      {/* Titolo */}
      <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-6">
        Il tuo Diario Cognitivo.
      </h1>
      
      {/* Sottotitolo */}
      <p className="text-base text-white/60 leading-relaxed max-w-sm">
        Niente post usa e getta. Il tuo profilo è un blog personale dove ciò che scrivi e ciò che comprendi costruisce la tua identità. Lascia un segno, non solo rumore.
      </p>
      
      {/* Button */}
      <Button
        onClick={nextSlide}
        className="mt-12 px-8 bg-primary hover:bg-primary/90"
      >
        Continua
      </Button>
    </div>
  );

  // Slide 4: Il Patto
  const SlidePatto = () => (
    <div className="flex flex-col items-center justify-center flex-1 px-8 pt-16 pb-20 text-center">
      {/* Titolo */}
      <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-6">
        NoParrot richiede tempo.
      </h1>
      
      {/* Sottotitolo */}
      <p className="text-base text-white/60 leading-relaxed max-w-sm mb-16">
        Stai scegliendo l'attrito al posto della comodità. Sei sicuro?
      </p>
      
      {/* Slider */}
      <div className="w-full max-w-sm">
        <SlideToUnlock onUnlock={onComplete} />
      </div>
    </div>
  );

  const slides = [SlideNemico, SlideDifesa, SlideAutore, SlidePatto];
  const CurrentSlideComponent = slides[currentSlide];

  // Handle tap/swipe for first slide
  const handleTap = () => {
    if (currentSlide === 0) {
      nextSlide();
    }
  };

  return (
    <div 
      className="min-h-screen bg-black flex flex-col relative"
      onClick={handleTap}
    >
      {/* Dots indicator */}
      <div className="absolute top-8 left-0 right-0 flex justify-center gap-2 z-10">
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
      <div className="flex-1 flex flex-col">
        <CurrentSlideComponent />
      </div>
    </div>
  );
};
