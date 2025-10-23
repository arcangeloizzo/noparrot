import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Brain, Scale, Megaphone } from "lucide-react";

interface OnboardingSlidesProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const OnboardingSlides = ({ onComplete, onSkip }: OnboardingSlidesProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const slides = [
    {
      icon: Brain,
      title: "Leggi.",
      description: "Ogni contenuto va compreso, non solo letto.",
      color: "#0A7AFF"
    },
    {
      icon: Scale,
      title: "Comprendi.",
      description: "Prima di condividere, rispondi a 3 domande.",
      color: "#0A7AFF"
    },
    {
      icon: Megaphone,
      title: "Condividi.",
      description: "Condividi solo ciò che hai capito davvero.",
      color: "#0A7AFF",
      blink: true
    }
  ];

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
    
    if (isLeftSwipe && currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
    
    if (isRightSwipe && currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const CurrentIcon = slides[currentSlide].icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0E141A] to-[#1F3347] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-primary/20 rounded-full animate-pulse" />
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-accent/30 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/3 left-1/3 w-3 h-3 bg-primary/10 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Skip button */}
      <button
        onClick={onSkip}
        className="absolute top-6 right-6 text-white/60 hover:text-white text-sm font-medium transition-colors z-10"
      >
        Salta
      </button>

      {/* Content */}
      <div 
        className="w-full max-w-md space-y-12 relative z-10"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div className={`w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center backdrop-blur-sm border border-primary/20 transition-all duration-300 ${slides[currentSlide].blink ? 'animate-[blink-parrot_0.3s_ease-in-out_infinite]' : ''}`}>
            <CurrentIcon className="w-16 h-16 text-primary" />
          </div>
        </div>

        {/* Text content with slide animation */}
        <div 
          key={currentSlide}
          className="text-center space-y-4 animate-fade-in"
        >
          <h2 className="text-4xl font-bold text-white">
            {slides[currentSlide].title}
          </h2>
          <p className="text-xl text-white/80 leading-relaxed">
            {slides[currentSlide].description}
          </p>
        </div>

        {/* Dots indicator */}
        <div className="flex justify-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentSlide 
                  ? 'w-8 bg-primary' 
                  : 'w-2 bg-white/30 hover:bg-white/50'
              }`}
              aria-label={`Vai alla slide ${index + 1}`}
            />
          ))}
        </div>

        {/* CTA Button */}
        <div className="space-y-4">
          {currentSlide === slides.length - 1 ? (
            <Button
              onClick={onComplete}
              className="w-full bg-gradient-to-r from-primary to-primary-blue hover:scale-105 text-white font-semibold py-6 rounded-full text-lg h-auto shadow-[0_0_40px_rgba(10,122,255,0.3)] transition-all duration-300"
            >
              Inizia il tuo viaggio
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="w-full bg-primary/20 backdrop-blur-sm border border-primary/30 hover:bg-primary/30 text-white font-semibold py-6 rounded-full text-lg h-auto transition-all duration-300"
            >
              Avanti
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
