import { Logo } from "@/components/ui/logo";

interface FloatingActionButtonProps {
  onClick: () => void;
}

export const FloatingActionButton = ({ onClick }: FloatingActionButtonProps) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-6 w-14 h-14 bg-primary-blue hover:bg-primary-blue/90 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50"
      style={{ right: 'calc((100vw - 375px) / 2 + 24px)' }}
    >
      <Logo variant="icon" size="sm" className="w-6 h-6" />
    </button>
  );
};