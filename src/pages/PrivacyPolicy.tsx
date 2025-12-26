import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 pb-24">
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
          <div className="flex items-center justify-center mb-6">
            <Logo />
          </div>
        </div>

        <Card className="p-8">
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Versione: v1 — Ultimo aggiornamento: 26 dicembre 2025
          </p>

          <div className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">1. Dati che raccogliamo</h2>
              <ul className="list-disc pl-6 space-y-1 text-foreground">
                <li><strong>Dati account:</strong> email, username, data di nascita, avatar (opzionale).</li>
                <li><strong>Dati tecnici:</strong> log di sicurezza, dispositivo, preferenze notifiche.</li>
                <li><strong>Dati di interazione:</strong> letture, commenti, salvataggi, reazioni — per personalizzare l'esperienza.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">2. Cognitive Density</h2>
              <p className="text-foreground">
                La Cognitive Density è una mappa dei tuoi interessi costruita dalle tue interazioni consapevoli. 
                Serve solo a personalizzare e migliorare l'esperienza in NoParrot. Non viene condivisa con terzi.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">3. Uso dell'intelligenza artificiale</h2>
              <p className="text-foreground">
                I tuoi contenuti possono essere elaborati dall'AI per funzionalità dell'app 
                (sintesi, classificazione, domande del percorso di comprensione).
              </p>
              <p className="text-foreground mt-2 font-medium">
                I tuoi dati non vengono utilizzati per addestrare modelli di terze parti, salvo consenso esplicito.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">4. I tuoi controlli</h2>
              <p className="text-foreground">
                Puoi gestire le tue preferenze e le impostazioni relative agli annunci 
                dalla sezione <strong>Impostazioni e privacy</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">5. Contatti</h2>
              <p className="text-foreground">
                <strong>Titolare del trattamento:</strong> Arcangelo Izzo<br />
                <strong>Email:</strong>{" "}
                <a href="mailto:support@noparrot.app" className="text-primary underline">
                  support@noparrot.app
                </a>
              </p>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
}