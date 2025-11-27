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

      {/* Overlay con gradiente più leggero - Pure Liquid Glass */}
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center px-6"
        style={{
          background: 'linear-gradient(180deg, rgba(14, 20, 26, 0.50) 0%, rgba(14, 20, 26, 0.30) 50%, rgba(14, 20, 26, 0.50) 100%)'
        }}
      >
        {/* Logo - Puro, senza box */}
        <div className="mb-16">
          <Logo 
            variant="white" 
            className="h-16 md:h-20 w-auto drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]"
          />
        </div>

        {/* Frase centrale - Solo testo con shadow */}
        <div className="max-w-2xl w-full text-center mb-12">
          <p className="text-foreground text-2xl md:text-3xl font-light leading-relaxed tracking-wide drop-shadow-[0_0_20px_rgba(0,0,0,0.5)] [text-shadow:0_2px_10px_rgba(0,0,0,0.3)]">
            {phrase}
          </p>
        </div>

        {/* Bottone Entra - Liquid Glass */}
        <button
          onClick={handleEnter}
          className="rounded-full px-12 py-6 text-lg font-medium text-white 
                     bg-white/10 backdrop-blur-xl 
                     border border-white/20
                     shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]
                     hover:bg-white/15 hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)]
                     transition-all duration-500"
        >
          Entra
        </button>
      </div>
    </div>
  );
};
