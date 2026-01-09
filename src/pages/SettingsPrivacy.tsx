import { ArrowLeft, FileText, Scale, Trash2, Shield, Brain, Megaphone, Sparkles, Download, Cookie, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserConsents, useToggleAdsPersonalization } from "@/hooks/useUserConsents";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useCognitiveTracking } from "@/hooks/useCognitiveTracking";
import { useExportUserData } from "@/hooks/useExportUserData";
import { useToggleEditorialNotifications } from "@/hooks/useToggleEditorialNotifications";
export default function SettingsPrivacy() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: consents, isLoading: consentsLoading } = useUserConsents();
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const toggleAds = useToggleAdsPersonalization();
  const { toggleTracking } = useCognitiveTracking();
  const { exportData, isExporting } = useExportUserData();
  const toggleEditorial = useToggleEditorialNotifications();

  const handleDeleteAccount = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user.id);

      if (error) throw error;

      await signOut();
      toast.success("Account cancellato con successo");
      navigate("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Errore durante la cancellazione dell'account");
    }
  };

  const handleAdsToggle = async (checked: boolean) => {
    try {
      await toggleAds.mutateAsync(checked);
      toast.success(checked ? "Annunci personalizzati attivati" : "Annunci personalizzati disattivati");
    } catch (error) {
      toast.error("Errore durante il salvataggio");
    }
  };

  const handleCognitiveTrackingToggle = async (checked: boolean) => {
    try {
      await toggleTracking.mutateAsync(checked);
    } catch (error) {
      // Error already handled in hook
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-6 pb-24">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Indietro
          </Button>
          <h1 className="text-2xl font-bold">Impostazioni e privacy</h1>
        </div>

        <div className="space-y-4">
          {/* Tracciamento cognitivo */}
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Brain className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold">Profilo cognitivo</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              NoParrot costruisce una mappa dei tuoi interessi in base alle tue interazioni 
              consapevoli (letture, commenti, condivisioni).
            </p>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border mb-3">
              <div className="space-y-1 flex-1 mr-4">
                <Label htmlFor="cognitive-tracking" className="text-sm font-medium cursor-pointer">
                  Tracciamento profilo cognitivo
                </Label>
                <p className="text-xs text-muted-foreground">
                  Se disattivato, non aggiorneremo la mappa dei tuoi interessi.
                </p>
              </div>
              <Switch
                id="cognitive-tracking"
                checked={profile?.cognitive_tracking_enabled ?? true}
                onCheckedChange={handleCognitiveTrackingToggle}
                disabled={profileLoading || toggleTracking.isPending}
              />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/profile#nebulosa")}
            >
              Visualizza la mia mappa
            </Button>
          </Card>

          {/* Notifiche */}
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Bell className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold">Notifiche</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Gestisci le notifiche push che ricevi dall'app.
            </p>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
              <div className="space-y-1 flex-1 mr-4">
                <Label htmlFor="editorial-notifications" className="text-sm font-medium cursor-pointer">
                  Notifiche Il Punto
                </Label>
                <p className="text-xs text-muted-foreground">
                  Ricevi una notifica quando viene pubblicato un nuovo editoriale (08:30, 14:30, 20:30)
                </p>
              </div>
              <Switch
                id="editorial-notifications"
                checked={profile?.editorial_notifications_enabled ?? true}
                onCheckedChange={(checked) => toggleEditorial.mutate(checked)}
                disabled={profileLoading || toggleEditorial.isPending}
              />
            </div>
          </Card>

          {/* Esporta i tuoi dati */}
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Download className="w-5 h-5 text-green-400" />
              <h2 className="text-lg font-semibold">Esporta i tuoi dati</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Scarica una copia di tutti i tuoi dati: profilo, post, commenti, 
              preferenze e mappa cognitiva in formato JSON.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={exportData}
              disabled={isExporting}
            >
              {isExporting ? "Esportazione in corso..." : "Scarica i miei dati"}
            </Button>
          </Card>

          {/* Annunci */}
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Megaphone className="w-5 h-5 text-orange-400" />
              <h2 className="text-lg font-semibold">Annunci</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Gli annunci su NoParrot sono mostrati in base al tema dei contenuti che leggi.
              Puoi scegliere se riceverne di più pertinenti in base ai tuoi interessi.
            </p>
            <div className={`flex items-center justify-between p-3 rounded-lg border ${
              profile?.cognitive_tracking_enabled === false 
                ? "bg-muted/10 border-muted" 
                : "bg-muted/30 border-border"
            }`}>
              <div className="space-y-1 flex-1 mr-4">
                <Label 
                  htmlFor="ads-personalization" 
                  className={`text-sm font-medium ${
                    profile?.cognitive_tracking_enabled === false ? "text-muted-foreground" : "cursor-pointer"
                  }`}
                >
                  Annunci basati sui miei interessi
                </Label>
                <p className="text-xs text-muted-foreground">
                  {profile?.cognitive_tracking_enabled === false 
                    ? "Per attivare gli annunci personalizzati, devi prima attivare il profilo cognitivo."
                    : "Se disattivato, vedrai solo annunci legati al tema della conversazione."
                  }
                </p>
              </div>
              <Switch
                id="ads-personalization"
                checked={profile?.cognitive_tracking_enabled === false ? false : (consents?.ads_personalization_opt_in ?? false)}
                onCheckedChange={handleAdsToggle}
                disabled={consentsLoading || toggleAds.isPending || profile?.cognitive_tracking_enabled === false}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Puoi cambiare idea in qualsiasi momento.
            </p>
          </Card>

          {/* Trasparenza su AI e fonti */}
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold">Trasparenza su AI e fonti</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Come generiamo "Il Punto", come funziona il Trust Score e cosa significa il percorso di comprensione.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/legal/transparency")}
            >
              Apri
            </Button>
          </Card>

          <Separator />

          {/* Documenti legali */}
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Documenti legali</h2>
            </div>
            <div className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => navigate("/privacy")}
              >
                <FileText className="w-4 h-4 mr-3" />
                Privacy Policy
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => navigate("/terms")}
              >
                <Scale className="w-4 h-4 mr-3" />
                Termini di Servizio
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => navigate("/legal/ads")}
              >
                <Megaphone className="w-4 h-4 mr-3" />
                Pubblicità
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => navigate("/cookies")}
              >
                <Cookie className="w-4 h-4 mr-3" />
                Cookie Policy
              </Button>
            </div>
          </Card>

          <Separator />

          {/* Gestione account */}
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="w-5 h-5 text-destructive" />
              <h2 className="text-lg font-semibold">Gestione account</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              L'eliminazione dell'account è permanente e comporterà la cancellazione di tutti i tuoi dati, post e commenti.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  Cancella il mio account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sei assolutamente sicuro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Questa azione non può essere annullata. Cancellerà permanentemente il tuo account
                    e rimuoverà tutti i tuoi dati dai nostri server.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Cancella account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Card>
        </div>
      </div>
    </div>
  );
}
