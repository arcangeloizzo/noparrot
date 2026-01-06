import { useNavigate } from "react-router-dom";
import { ArrowLeft, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

export default function AdsPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Pubblicità</h1>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-6">
        {/* Logo */}
        <div className="flex justify-center py-4">
          <Logo size="md" />
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <div className="p-2 rounded-lg bg-primary/10">
                <Megaphone className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Pubblicità</h2>
            </div>

            <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
              <p className="text-foreground font-medium">
                In NoParrot gli annunci seguono tre principi:
              </p>

              <div className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <h3 className="font-semibold text-foreground mb-2">
                    🎯 Contextual first
                  </h3>
                  <p>
                    Gli annunci possono essere mostrati in base al tema del contenuto visualizzato 
                    (categoria o argomento). Questo approccio non richiede dati personali.
                  </p>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <h3 className="font-semibold text-foreground mb-2">
                    👤 Persona second
                  </h3>
                  <p>
                    Possiamo migliorare la pertinenza senza usare dati sensibili, 
                    con logiche non invasive e aggregate.
                  </p>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <h3 className="font-semibold text-foreground mb-2">
                    🧠 Cognitivo solo con consenso
                  </h3>
                  <p>
                    Se attivi "Annunci basati sui miei interessi", useremo anche la tua 
                    mappa di interessi per mostrarti annunci più rilevanti.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-3">
                <p>
                  Se disattivi il feed personalizzato, gli annunci basati sugli interessi 
                  vengono disattivati e vedrai solo annunci contestuali.
                </p>
                <p>
                  Puoi attivare o disattivare la personalizzazione in qualsiasi momento 
                  dalle <strong className="text-foreground">Impostazioni → Privacy</strong>.
                </p>
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <p className="text-sm text-amber-200">
                    ⚠️ Se disattivi il profilo cognitivo, gli annunci non potranno più essere 
                    personalizzati in base ai tuoi interessi, anche se avevi precedentemente 
                    dato il consenso.
                  </p>
                </div>
                <p className="font-medium text-foreground">
                  NoParrot non vende dati personali.
                </p>
              </div>
            </div>

            {/* Version footer */}
            <div className="pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Versione: v2 — Ultimo aggiornamento: 6 gennaio 2026
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
