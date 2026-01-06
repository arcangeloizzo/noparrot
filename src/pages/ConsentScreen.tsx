import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/contexts/AuthContext";
import { useUpsertConsents, setConsentCompleted, savePendingConsent } from "@/hooks/useUserConsents";
import { ExternalLink } from "lucide-react";

interface ConsentScreenProps {
  onComplete?: () => void;
}

export default function ConsentScreen({ onComplete }: ConsentScreenProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const upsertConsents = useUpsertConsents();
  
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [adsOptIn, setAdsOptIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!termsAccepted) return;
    
    setIsSubmitting(true);
    try {
      if (user) {
        // User is authenticated, save to database
        await upsertConsents.mutateAsync({
          accepted_terms: true,
          accepted_privacy: true,
          ads_personalization_opt_in: adsOptIn,
          consent_version: "v1",
        });
      } else {
        // User not authenticated, save to localStorage
        savePendingConsent({
          accepted_terms: true,
          accepted_privacy: true,
          ads_personalization_opt_in: adsOptIn,
          consent_version: "v1",
        });
      }
      
      setConsentCompleted();
      
      // If we have an onComplete callback (from OnboardingFlow), use it
      if (onComplete) {
        onComplete();
      } else {
        // Otherwise navigate based on auth state
        if (user) {
          navigate("/", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }
    } catch (error) {
      console.error("Error saving consents:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold text-center">
              Prima di iniziare
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main explanation */}
            <div className="text-sm text-muted-foreground space-y-4">
              <p>
                Usiamo una <strong className="text-foreground">mappa di interessi</strong> per personalizzare il feed.
                Puoi disattivarla in qualsiasi momento dalle Impostazioni → Privacy.
              </p>
              
              <div>
                <p className="font-medium text-foreground mb-2">Usiamo questi dati per:</p>
                <ul className="space-y-1 ml-4">
                  <li>• personalizzare il feed</li>
                  <li>• migliorare la qualità delle conversazioni</li>
                  <li>• rendere più chiari contesti e fonti</li>
                </ul>
              </div>
              
              <p>
                Puoi scegliere se ricevere annunci più pertinenti in base ai tuoi interessi.
                Se non dai il consenso, vedrai comunque annunci legati al tema del contenuto.
              </p>
            </div>

            {/* Mandatory checkbox */}
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="terms-privacy"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label 
                    htmlFor="terms-privacy" 
                    className="text-sm font-medium cursor-pointer"
                  >
                    Accetto Termini e Privacy *
                  </Label>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <a 
                      href="/privacy" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Privacy Policy <ExternalLink className="w-3 h-3" />
                    </a>
                    <span className="text-muted-foreground">•</span>
                    <a 
                      href="/terms" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Termini di Servizio <ExternalLink className="w-3 h-3" />
                    </a>
                    <span className="text-muted-foreground">•</span>
                    <a 
                      href="/legal/ads" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Come funzionano gli annunci <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Optional ads toggle */}
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="ads-personalization" className="text-sm font-medium">
                    Consento annunci basati sui miei interessi
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Se disattivato, vedrai solo annunci basati sul contesto del contenuto.
                  </p>
                </div>
                <Switch
                  id="ads-personalization"
                  checked={adsOptIn}
                  onCheckedChange={setAdsOptIn}
                />
              </div>
            </div>

            {/* Continue button */}
            <Button
              onClick={handleContinue}
              disabled={!termsAccepted || isSubmitting}
              className="w-full mt-6"
              size="lg"
            >
              {isSubmitting ? "Salvataggio..." : "Continua"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
