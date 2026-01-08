import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

interface ReadyScreenProps {
  onEnter: () => void;
}

export const ReadyScreen = ({ onEnter }: ReadyScreenProps) => {
  return (
    <div className="min-h-screen bg-[#0E141A] flex flex-col items-center justify-center px-8">
      <div className="flex flex-col items-center text-center space-y-12 animate-fade-in">
        {/* Logo */}
        <Logo variant="icon" size="lg" className="w-24 h-auto opacity-80" />
        
        {/* Message */}
        <div className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            Sei pronto a partecipare<br />con consapevolezza?
          </h1>
        </div>
        
        {/* CTA */}
        <Button
          onClick={onEnter}
          className="w-full max-w-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 rounded-full text-lg h-auto"
        >
          Entra
        </Button>
      </div>
    </div>
  );
};
