import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Scale, Megaphone } from "lucide-react";

interface MissionPageProps {
  onCreateAccount: () => void;
  onLogin: () => void;
}

export const MissionPage = ({ onCreateAccount, onLogin }: MissionPageProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Mission Card */}
        <Card className="shadow-[0_2px_8px_rgba(0,0,0,0.35)] border-border/50 animate-fade-in">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-semibold text-foreground">
              Missione di NoParrot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mission Points */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <Brain className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground">Comprendere</h3>
                  <p className="text-sm text-muted-foreground">
                    Metti alla prova la tua comprensione prima di condividere.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <Scale className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground">Confrontare</h3>
                  <p className="text-sm text-muted-foreground">
                    Scopri punti di vista diversi sullo stesso tema.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <Megaphone className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground">Condividere</h3>
                  <p className="text-sm text-muted-foreground">
                    Diffondi informazioni verificate e comprese.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-4 text-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <Button 
            onClick={onCreateAccount}
            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-full h-11 shadow-[inset_0_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            Crea un account
          </Button>
          
          <button 
            onClick={onLogin}
            className="text-primary hover:text-primary/80 font-medium text-sm transition-colors"
          >
            Accedi
          </button>
        </div>
      </div>
    </div>
  );
};