import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

export default function TermsOfService() {
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
          <h1 className="text-3xl font-bold mb-2">Termini di Servizio</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Ultimo aggiornamento: 24 ottobre 2025
          </p>

          <div className="prose prose-sm max-w-none space-y-6">
            <section>
              <p className="text-foreground">
                Benvenuto in NOPARROT. Utilizzando l'app, accetti i presenti termini.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">1. Scopo del servizio</h2>
              <p className="text-foreground">
                NOPARROT è una piattaforma sociale dedicata alla condivisione consapevole di contenuti, previa verifica di comprensione tramite test AI.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">2. Requisiti d'età</h2>
              <p className="text-foreground">
                L'uso è riservato a utenti maggiorenni (18+).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">3. Contenuti e responsabilità</h2>
              <p className="text-foreground">
                Gli utenti sono responsabili dei contenuti che condividono o commentano.
                NOPARROT non effettua fact-checking, ma promuove la comprensione critica.
                Il team può rimuovere contenuti offensivi, illegali o contrari alla missione.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">4. Proprietà intellettuale</h2>
              <p className="text-foreground">
                Il nome, il logo e il meccanismo Comprehension Gate™ sono proprietà esclusiva del progetto NOPARROT.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">5. Limitazione di responsabilità</h2>
              <p className="text-foreground">
                L'app è fornita "così com'è" in fase sperimentale.
                Il titolare non è responsabile di eventuali malfunzionamenti, perdite di dati o contenuti di terzi.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">6. Cancellazione dell'account</h2>
              <p className="text-foreground">
                Puoi cancellare in qualsiasi momento il tuo account dalla sezione Impostazioni e privacy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">7. Modifiche ai termini</h2>
              <p className="text-foreground">
                NOPARROT può aggiornare questi termini previa notifica. L'uso continuato dell'app implica accettazione delle modifiche.
              </p>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
}