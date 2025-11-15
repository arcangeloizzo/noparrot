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
      className="cognitive-fab flex items-center justify-center"
      aria-label="Crea post"
    >
      <Logo 
        variant="white" 
        size="lg"
        className="w-8 h-8 relative z-10"
      />
    </button>
  );
};
