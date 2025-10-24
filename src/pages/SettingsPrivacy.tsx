import { ArrowLeft, FileText, Scale, Trash2, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

export default function SettingsPrivacy() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleDeleteAccount = async () => {
    if (!user) return;

    try {
      // Delete user profile and related data (cascading deletes should handle posts, comments, etc.)
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user.id);

      if (error) throw error;

      // Sign out and redirect
      await signOut();
      toast.success("Account cancellato con successo");
      navigate("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Errore durante la cancellazione dell'account");
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