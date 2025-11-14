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
      {/* Utilizziamo il componente Logo con variant="icon" e size="md" o "lg" */}
      <Logo 
        variant="icon" 
        size="md" // Puoi provare "lg" se vuoi che sia più grande di w-8 h-8
        className="w-8 h-8 relative z-10" // Mantiene le dimensioni e classi attuali
      />
    </button>
  );
};
