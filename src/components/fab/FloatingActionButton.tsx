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
      className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full flex items-center justify-center group transition-all duration-200 hover:scale-110 active:scale-95"
      style={{
        background: 'linear-gradient(to bottom right, #2563EB, #3B82F6)',
        boxShadow: '0 8px 32px rgba(37, 99, 235, 0.4)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(37, 99, 235, 0.6)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(37, 99, 235, 0.4)';
      }}
      aria-label="Crea post"
    >
      <Logo 
        variant="white" 
        size="lg"
        className="w-8 h-8 relative z-10 group-hover:scale-110 transition-transform"
      />
    </button>
  );
};
