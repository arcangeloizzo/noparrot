import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getRandomWelcomePhrase } from '@/data/welcomePhrases';
import { Logo } from '@/components/ui/logo';
import { usePosts } from '@/hooks/usePosts';
import { FeedCard } from '@/components/feed/FeedCardAdapt';

interface WelcomeRitualScreenProps {
  onEnter: () => void;
}

export const WelcomeRitualScreen = ({ onEnter }: WelcomeRitualScreenProps) => {
  const [phrase, setPhrase] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const { data: posts = [] } = usePosts();

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
      className="fixed inset-0 z-[100] transition-opacity duration-300"
      style={{ 
        opacity: isVisible ? 1 : 0
      }}
    >
      {/* Feed in background con blur - Liquid Glass Effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="max-w-[600px] mx-auto h-full overflow-y-auto blur-xl opacity-50 scale-105">
          <div className="divide-y divide-border pt-20">
            {posts.slice(0, 5).map(post => (
              <FeedCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </div>

      {/* Overlay con gradiente ridotto - Frosted Glass */}
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center px-6"
        style={{
          background: 'linear-gradient(180deg, rgba(14, 20, 26, 0.70) 0%, rgba(14, 20, 26, 0.50) 50%, rgba(14, 20, 26, 0.70) 100%)'
        }}
      >
        {/* Logo */}
        <div className="mb-16 backdrop-blur-sm">
          <Logo 
            variant="white" 
            className="h-16 md:h-20 w-auto"
          />
        </div>

        {/* Frase centrale */}
        <div className="max-w-2xl w-full text-center mb-12 backdrop-blur-sm">
          <p className="text-foreground text-2xl md:text-3xl font-light leading-relaxed tracking-wide drop-shadow-lg">
            {phrase}
          </p>
        </div>

        {/* Bottone Entra */}
        <Button
          onClick={handleEnter}
          size="lg"
          className="rounded-full px-12 py-6 text-lg font-medium bg-[#0A7AFF] hover:bg-[#0A7AFF]/90 text-white shadow-lg transition-all duration-200 backdrop-blur-sm"
        >
          Entra
        </Button>
      </div>
    </div>
  );
};
