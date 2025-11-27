import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getRandomWelcomePhrase } from '@/data/welcomePhrases';

interface WelcomeRitualScreenProps {
  onEnter: () => void;
}

export const WelcomeRitualScreen = ({ onEnter }: WelcomeRitualScreenProps) => {
  const [phrase, setPhrase] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Seleziona frase casuale
    setPhrase(getRandomWelcomePhrase());
    
    // Fade in dopo breve delay
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleEnter = () => {
    setIsVisible(false);
    setTimeout(() => onEnter(), 300);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 transition-opacity duration-300"
      style={{ 
        backgroundColor: '#0E141A',
        opacity: isVisible ? 1 : 0
      }}
    >
      {/* Frase centrale */}
      <div className="max-w-2xl w-full text-center mb-12">
        <p className="text-foreground text-2xl md:text-3xl font-light leading-relaxed tracking-wide">
          {phrase}
        </p>
      </div>

      {/* Bottone Entra */}
      <Button
        onClick={handleEnter}
        size="lg"
        className="rounded-full px-12 py-6 text-lg font-medium bg-[#0A7AFF] hover:bg-[#0A7AFF]/90 text-white shadow-lg transition-all duration-200"
      >
        Entra
      </Button>
    </div>
  );
};
