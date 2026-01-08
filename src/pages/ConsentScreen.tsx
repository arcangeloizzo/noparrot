import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useUpsertConsents, setConsentCompleted, savePendingConsent } from "@/hooks/useUserConsents";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Network } from "lucide-react";

interface ConsentScreenProps {
  onComplete?: () => void;
}

export default function ConsentScreen({ onComplete }: ConsentScreenProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const upsertConsents = useUpsertConsents();
  
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [adsOptIn, setAdsOptIn] = useState(false);
  const [cognitiveOptIn, setCognitiveOptIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!termsAccepted) return;
    
    setIsSubmitting(true);
    try {
      if (user) {
        // User is authenticated, save consents to database
        await upsertConsents.mutateAsync({
          accepted_terms: true,
          accepted_privacy: true,
          ads_personalization_opt_in: adsOptIn,
          consent_version: "2.0",
        });
        
        // Update cognitive tracking preference in profile
        await supabase
          .from('profiles')
          .update({ cognitive_tracking_enabled: cognitiveOptIn })
          .eq('id', user.id);
      } else {
        // User not authenticated, save to localStorage
        savePendingConsent({
          accepted_terms: true,
          accepted_privacy: true,
          ads_personalization_opt_in: adsOptIn,
          consent_version: "2.0",
        });
        // Store cognitive preference for sync after auth
        localStorage.setItem('noparrot-pending-cognitive-opt-in', JSON.stringify(cognitiveOptIn));
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
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Icon */}
        <div className="flex justify-center">
          <Network className="w-20 h-20 text-primary stroke-[1.5]" />
        </div>

        {/* Title */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            I dati servono a te.
          </h1>
          <p className="text-base text-white/60 leading-relaxed">
            Non vendiamo la tua identità a terzi. La tua mappa cognitiva serve a te, non al mercato. La pubblicità? Ci sarà, ma alle tue condizioni: trasparente, etica e sotto il tuo controllo. Niente sorveglianza.
          </p>
        </div>

        {/* Consent options */}
        <div className="space-y-4 pt-4">
          {/* Mandatory checkbox */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="terms-privacy"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                className="mt-0.5 border-white/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <div className="space-y-2">
                <Label 
                  htmlFor="terms-privacy" 
                  className="text-sm font-medium text-white cursor-pointer"
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
                  <span className="text-white/30">•</span>
                  <a 
                    href="/terms" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Termini di Servizio <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Cognitive tracking toggle */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1 mr-4">
                <Label htmlFor="cognitive-tracking" className="text-sm font-medium text-white">
                  Mappa Cognitiva
                </Label>
                <p className="text-xs text-white/50">
                  Traccia i tuoi interessi per personalizzare il feed
                </p>
              </div>
              <Switch
                id="cognitive-tracking"
                checked={cognitiveOptIn}
                onCheckedChange={setCognitiveOptIn}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </div>

          {/* Optional ads toggle */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1 mr-4">
                <Label htmlFor="ads-personalization" className="text-sm font-medium text-white">
                  Annunci personalizzati
                </Label>
                <p className="text-xs text-white/50">
                  Se disattivato, vedrai solo annunci contestuali
                </p>
              </div>
              <Switch
                id="ads-personalization"
                checked={adsOptIn}
                onCheckedChange={setAdsOptIn}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </div>
        </div>

        {/* Continue button */}
        <Button
          onClick={handleContinue}
          disabled={!termsAccepted || isSubmitting}
          className="w-full h-14 mt-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full text-base"
          size="lg"
        >
          {isSubmitting ? "Salvataggio..." : "Crea il tuo account"}
        </Button>
      </div>
    </div>
  );
}
