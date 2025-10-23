import { Logo } from "@/components/ui/logo";
import { haptics } from "@/lib/haptics";

interface FloatingActionButtonProps {
  onClick: () => void;
}

export const FloatingActionButton = ({ onClick }: FloatingActionButtonProps) => {
  const handleClick = () => {
    haptics.medium();
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className="fixed w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center apple-spring gentle-hover focus-ring group overflow-hidden transition-all duration-200 hover:scale-110 active:scale-95"
      style={{ 
        right: 'max(16px, env(safe-area-inset-right))',
        bottom: 'calc(80px + env(safe-area-inset-bottom))',
        zIndex: 1000,
        boxShadow: '0 6px 18px rgba(0,0,0,.24)'
      }}
      aria-label="Crea post"
    >
      <img 
        src="/lovable-uploads/f6970c06-9fd9-4430-b863-07384bbb05ce.png"
        alt="NOPARROT"
        className="w-6 h-6 relative z-10 transition-transform duration-200"
      />
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-primary-blue opacity-90" style={{ filter: 'blur(2px)', zIndex: -1 }} />
    </button>
  );
};