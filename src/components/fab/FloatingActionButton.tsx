import { Logo } from "@/components/ui/logo";

interface FloatingActionButtonProps {
  onClick: () => void;
}

export const FloatingActionButton = ({ onClick }: FloatingActionButtonProps) => {
  return (
    <div className="fixed bottom-20 z-50" style={{ 
      right: 'max(24px, calc((100vw - 375px) / 2 + 24px))',
      maxWidth: '375px',
      left: 'auto'
    }}>
      <button
        onClick={onClick}
        className="relative w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center aspect-square apple-spring gentle-hover focus-ring group overflow-hidden"
        style={{ boxShadow: 'var(--shadow-floating)' }}
      >        
        {/* Icon */}
        <img 
          src="/lovable-uploads/f6970c06-9fd9-4430-b863-07384bbb05ce.png"
          alt="NOPARROT"
          className="w-6 h-6 relative z-10 transition-transform duration-200"
        />
        
        {/* Subtle background gradient */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-primary-blue opacity-90" style={{ filter: 'blur(2px)', zIndex: -1 }} />
      </button>
    </div>
  );
};