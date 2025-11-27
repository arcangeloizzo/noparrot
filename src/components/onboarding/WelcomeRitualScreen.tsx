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
    setTimeout(() => onEnter(), 600);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] transition-all duration-700 ease-out"
      style={{ 
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : 'scale(1.05)'
      }}
    >
      {/* Feed in background con blur - Liquid Glass Effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="max-w-[600px] mx-auto h-full overflow-y-auto blur-2xl opacity-60 scale-110">
          <div className="divide-y divide-border pt-20">
            {posts.slice(0, 5).map(post => (
              <FeedCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </div>

      {/* Overlay con gradiente più leggero - Frosted Glass */}
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center px-6"
        style={{
          background: 'linear-gradient(180deg, rgba(14, 20, 26, 0.50) 0%, rgba(14, 20, 26, 0.30) 50%, rgba(14, 20, 26, 0.50) 100%)'
        }}
      >
        {/* Logo */}
        <div className="mb-16 backdrop-blur-lg bg-background/10 rounded-3xl p-6 border border-white/10">
          <Logo 
            variant="white" 
            className="h-16 md:h-20 w-auto"
          />
        </div>

        {/* Frase centrale */}
        <div className="max-w-2xl w-full text-center mb-12 backdrop-blur-lg bg-background/10 rounded-3xl p-8 border border-white/10">
          <p className="text-foreground text-2xl md:text-3xl font-light leading-relaxed tracking-wide drop-shadow-2xl">
            {phrase}
          </p>
        </div>

        {/* Bottone Entra */}
        <Button
          onClick={handleEnter}
          size="lg"
          className="rounded-full px-12 py-6 text-lg font-medium bg-[#0A7AFF] hover:bg-[#0A7AFF]/90 text-white shadow-2xl transition-all duration-500 backdrop-blur-lg border border-white/20"
        >
          Entra
        </Button>
      </div>
    </div>
  );
};
