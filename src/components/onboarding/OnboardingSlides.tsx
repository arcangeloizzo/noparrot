import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { FeedPreviewMock } from "./FeedPreviewMock";

interface OnboardingSlidesProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const OnboardingSlides = ({ onComplete, onSkip }: OnboardingSlidesProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const totalSlides = 4;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe && currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
    }
    
    if (isRightSwipe && currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  // Slide 0: The Problem
  const renderProblemSlide = () => (
    <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
          Sui social si condivide senza capire.
        </h1>
        <p className="text-lg text-white/60">
          E l'informazione si degrada.
        </p>
      </div>
      
      {/* Small logo at bottom */}
      <div className="absolute bottom-24">
        <Logo variant="icon" size="sm" className="w-10 h-auto opacity-40" />
      </div>
      
      {/* Swipe hint */}
      <p className="absolute bottom-8 text-sm text-white/40">
        Scorri per continuare
      </p>
    </div>
  );

  // Slide 1: The Rule
  const renderRuleSlide = () => (
    <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
      <div className="space-y-8 animate-fade-in">
        <Logo variant="icon" size="lg" className="w-20 h-auto mx-auto" />
        
        <div className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            NoParrot cambia la regola.
          </h1>
          <p className="text-lg text-white/60">
            Prima comprendi. Poi partecipi.
          </p>
        </div>
      </div>
      
      <div className="absolute bottom-8 left-0 right-0 px-8">
        <Button
          onClick={handleNext}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 rounded-full text-lg h-auto"
        >
          Continua
        </Button>
      </div>
    </div>
  );

  // Slide 2: The Ritual
  const renderRitualSlide = () => (
    <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
      <div className="space-y-8 animate-fade-in">
        {/* Abstract minimal UI representation */}
        <div className="flex flex-col items-center gap-3 mb-4">
          <div className="w-48 h-2 bg-white/20 rounded-full" />
          <div className="w-36 h-2 bg-white/10 rounded-full" />
          <div className="flex gap-2 mt-2">
            <div className="w-8 h-8 rounded-lg bg-primary/30 border border-primary/40" />
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20" />
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20" />
          </div>
        </div>
        
        <div className="space-y-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
            Per commentare o condividere,<br />
            passi da un momento di comprensione.
          </h1>
          <p className="text-lg text-white/60">
            Non per avere ragione.<br />
            Per sapere di cosa stai parlando.
          </p>
        </div>
      </div>
      
      <div className="absolute bottom-8 left-0 right-0 px-8">
        <Button
          onClick={handleNext}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 rounded-full text-lg h-auto"
        >
          Continua
        </Button>
      </div>
    </div>
  );

  // Slide 3: Real Product Preview
  const renderProductSlide = () => (
    <div className="flex flex-col items-center justify-between flex-1 pt-12 pb-8">
      <div className="text-center px-8 space-y-2 animate-fade-in">
        <h1 className="text-3xl md:text-4xl font-bold text-white">
          Questo è NoParrot.
        </h1>
        <p className="text-lg text-white/60">
          Notizie. ◉ Il Punto. Discussioni consapevoli.
        </p>
      </div>
      
      {/* Feed Preview Mock */}
      <div className="flex-1 w-full max-w-sm mx-auto mt-6 mb-6 px-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <FeedPreviewMock />
      </div>
      
      <div className="w-full px-8">
        <Button
          onClick={handleNext}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 rounded-full text-lg h-auto"
        >
          Continua
        </Button>
      </div>
    </div>
  );

  const renderCurrentSlide = () => {
    switch (currentSlide) {
      case 0:
        return renderProblemSlide();
      case 1:
        return renderRuleSlide();
      case 2:
        return renderRitualSlide();
      case 3:
        return renderProductSlide();
      default:
        return null;
    }
  };

  return (
    <div 
      className="min-h-screen bg-[#0E141A] flex flex-col relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip button */}
      <button
        onClick={onSkip}
        className="absolute top-6 right-6 text-white/40 hover:text-white/70 text-sm font-medium transition-colors z-10"
      >
        Salta
      </button>

      {/* Content */}
      <div className="flex-1 flex flex-col relative">
        {renderCurrentSlide()}
      </div>

      {/* Dots indicator - only for swipeable slides */}
      {currentSlide === 0 && (
        <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-2">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === currentSlide 
                  ? 'w-6 bg-primary' 
                  : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
