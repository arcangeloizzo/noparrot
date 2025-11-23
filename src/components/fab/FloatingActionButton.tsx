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
      className="liquid-glass-fab fixed bottom-20 right-6 w-14 h-14 rounded-full flex items-center justify-center z-30 transition-all duration-300 active:scale-95"
      aria-label="Crea post"
    >
      <Logo 
        variant="white" 
        size="lg"
        className="w-8 h-8 relative z-10 icon-glow"
      />
    </button>
  );
};
