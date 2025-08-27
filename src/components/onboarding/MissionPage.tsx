import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, MessageSquare, Megaphone } from "lucide-react";

interface MissionPageProps {
  onCreateAccount: () => void;
  onLogin: () => void;
}

export const MissionPage = ({ onCreateAccount, onLogin }: MissionPageProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Mission Card */}
        <Card className="shadow-card border-border/50">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-semibold text-foreground">
              Our Mission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mission Points */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Lightbulb className="w-5 h-5 text-primary-blue mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground">Understand</h3>
                  <p className="text-sm text-muted-foreground">
                    Test your comprehension before sharing content
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <MessageSquare className="w-5 h-5 text-primary-blue mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground">Contrast</h3>
                  <p className="text-sm text-muted-foreground">
                    See different perspectives on the same topic
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Megaphone className="w-5 h-5 text-primary-blue mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground">Share</h3>
                  <p className="text-sm text-muted-foreground">
                    Spread verified, understood information
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-4 text-center">
          <Button 
            onClick={onCreateAccount}
            className="w-full bg-primary-blue hover:bg-primary-blue/90 text-white font-semibold py-3 rounded-full h-11"
          >
            Create Account
          </Button>
          
          <button 
            onClick={onLogin}
            className="text-primary-blue hover:text-primary-blue/80 font-medium text-sm transition-colors"
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
};