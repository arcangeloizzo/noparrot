import { Logo } from "@/components/ui/logo";

interface FloatingActionButtonProps {
  onClick: () => void;
}

export const FloatingActionButton = ({ onClick }: FloatingActionButtonProps) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50 aspect-square"
      style={{ 
        right: 'max(24px, calc((100vw - 375px) / 2 + 24px))',
        maxWidth: '375px',
        left: 'auto'
      }}
    >
      <img 
        src="/lovable-uploads/f6970c06-9fd9-4430-b863-07384bbb05ce.png"
        alt="NOPARROT"
        className="w-6 h-6"
      />
    </button>
  );
};