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
      <img 
        src="/lovable-uploads/f6970c06-9fd9-4430-b863-07384bbb05ce.png"
        alt="NOPARROT"
        className="w-8 h-8 relative z-10"
      />
    </button>
  );
};