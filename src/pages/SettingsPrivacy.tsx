import { ArrowLeft, FileText, Scale, Trash2, Shield, Brain, Megaphone, Sparkles, Download, Cookie, Bell, RefreshCw, Heart, MessageCircle, AtSign, UserPlus, Mail, Repeat2, Palette } from "lucide-react";
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
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNotificationPreferences, NotificationPreferenceField } from "@/hooks/useNotificationPreferences";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";

export default function SettingsPrivacy() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: consents, isLoading: consentsLoading } = useUserConsents();
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const toggleAds = useToggleAdsPersonalization();
  const { toggleTracking } = useCognitiveTracking();
  const { exportData, isExporting } = useExportUserData();
  const { toggle: toggleNotification } = useNotificationPreferences();
  const { 
    permission, 
    isSupported, 
    isSubscribed, 
    requestPermission, 
    forceSync,
    isIOS,
    isPWA 
  } = usePushNotifications();

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

  const handleNotificationToggle = (field: NotificationPreferenceField) => (checked: boolean) => {
    toggleNotification.mutate({ field, enabled: checked });
  };

  const handleForceSync = async () => {
    toast.info("Sincronizzazione in corso...");
    const success = await forceSync();
    if (success) {
      toast.success("Notifiche push sincronizzate!");
    } else {
      toast.error("Errore durante la sincronizzazione");
    }
  };

  // Push status indicator
  const getPushStatus = () => {
    if (!isSupported) {
      if (isIOS && !isPWA) {
        return { status: 'ios-browser', label: 'Installa l\'app per ricevere notifiche', color: 'text-amber-500' };
      }
      return { status: 'unsupported', label: 'Non supportato', color: 'text-muted-foreground' };
    }
    if (permission === 'denied') {
      return { status: 'denied', label: 'Bloccate dal browser', color: 'text-destructive' };
    }
    if (permission === 'default') {
      return { status: 'not-requested', label: 'Non attivate', color: 'text-amber-500' };
    }
    if (isSubscribed) {
      return { status: 'active', label: 'Attive ✓', color: 'text-green-500' };
    }
    return { status: 'permission-granted', label: 'Sincronizzazione richiesta', color: 'text-amber-500' };
  };

  const pushStatus = getPushStatus();

  // Notification preference items
  const notificationPrefs = [
    { field: 'editorial_notifications_enabled' as NotificationPreferenceField, label: 'Il Punto (editoriali)', description: 'Nuovi editoriali alle 08:30, 14:30, 20:30', icon: Bell, value: profile?.editorial_notifications_enabled ?? true },
    { field: 'notifications_likes_enabled' as NotificationPreferenceField, label: 'Like', description: 'Quando qualcuno mette like ai tuoi contenuti', icon: Heart, value: (profile as any)?.notifications_likes_enabled ?? true },
    { field: 'notifications_comments_enabled' as NotificationPreferenceField, label: 'Commenti', description: 'Quando qualcuno commenta i tuoi post', icon: MessageCircle, value: (profile as any)?.notifications_comments_enabled ?? true },
    { field: 'notifications_mentions_enabled' as NotificationPreferenceField, label: 'Menzioni', description: 'Quando qualcuno ti tagga', icon: AtSign, value: (profile as any)?.notifications_mentions_enabled ?? true },
    { field: 'notifications_follows_enabled' as NotificationPreferenceField, label: 'Nuovi follower', description: 'Quando qualcuno inizia a seguirti', icon: UserPlus, value: (profile as any)?.notifications_follows_enabled ?? true },
    { field: 'notifications_messages_enabled' as NotificationPreferenceField, label: 'Messaggi', description: 'Quando ricevi un messaggio privato', icon: Mail, value: (profile as any)?.notifications_messages_enabled ?? true },
    { field: 'notifications_reshares_enabled' as NotificationPreferenceField, label: 'Condivisioni', description: 'Quando qualcuno condivide il tuo post', icon: Repeat2, value: (profile as any)?.notifications_reshares_enabled ?? true },
  ];

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
          {/* Aspetto / Theme */}
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Palette className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold">Aspetto</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Scegli il tema dell'app. "Sistema" seguirà le impostazioni del tuo dispositivo.
            </p>
            <ThemeSwitcher />
          </Card>

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
            
            {/* Push Status */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border mb-4">
              <div className="space-y-1 flex-1 mr-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Stato notifiche push:</span>
                  <span className={`text-sm font-medium ${pushStatus.color}`}>
                    {pushStatus.label}
                  </span>
                </div>
                {pushStatus.status === 'denied' && (
                  <p className="text-xs text-muted-foreground">
                    Abilita le notifiche nelle impostazioni del browser
                  </p>
                )}
              </div>
              {pushStatus.status === 'not-requested' && (
                <Button size="sm" onClick={requestPermission}>
                  Attiva
                </Button>
              )}
              {(pushStatus.status === 'active' || pushStatus.status === 'permission-granted') && (
                <Button size="sm" variant="outline" onClick={handleForceSync}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Sincronizza
                </Button>
              )}
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Scegli quali notifiche push vuoi ricevere.
            </p>

            <div className="space-y-2">
              {notificationPrefs.map((pref) => {
                const Icon = pref.icon;
                return (
                  <div 
                    key={pref.field}
                    className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50"
                  >
                    <div className="flex items-center gap-3 flex-1 mr-4">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <div className="space-y-0.5">
                        <Label htmlFor={pref.field} className="text-sm font-medium cursor-pointer">
                          {pref.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {pref.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={pref.field}
                      checked={pref.value}
                      onCheckedChange={handleNotificationToggle(pref.field)}
                      disabled={profileLoading || toggleNotification.isPending}
                    />
                  </div>
                );
              })}
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
