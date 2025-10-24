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
            Ultimo aggiornamento: 24 ottobre 2025
          </p>

          <div className="prose prose-sm max-w-none space-y-6">
            <section>
              <p className="text-foreground">
                NOPARROT è un'applicazione sperimentale sviluppata per promuovere la comprensione e la condivisione consapevole dei contenuti online.
                Il titolare del trattamento dei dati è Arcangelo Izzo, contattabile all'indirizzo{" "}
                <a href="mailto:support@noparrot.app" className="text-primary underline">
                  support@noparrot.app
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">1. Dati raccolti</h2>
              <p className="text-foreground">NOPARROT tratta i seguenti dati:</p>
              <ul className="list-disc pl-6 space-y-1 text-foreground">
                <li><strong>Dati account:</strong> email, nome, immagine profilo, password cifrata.</li>
                <li><strong>Dati di utilizzo:</strong> post, commenti, interazioni, risultati dei test AI.</li>
                <li><strong>Dati tecnici:</strong> indirizzo IP, tipo di dispositivo, cookie tecnici.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">2. Finalità del trattamento</h2>
              <p className="text-foreground">I dati vengono utilizzati per:</p>
              <ul className="list-disc pl-6 space-y-1 text-foreground">
                <li>fornire e migliorare i servizi dell'app;</li>
                <li>garantire la sicurezza e prevenire abusi;</li>
                <li>analizzare in forma aggregata l'utilizzo della piattaforma.</li>
              </ul>
              <p className="text-foreground mt-3">
                La base giuridica è l'esecuzione del servizio e il legittimo interesse del titolare.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">3. Conservazione dei dati</h2>
              <p className="text-foreground">
                I dati sono conservati per il tempo necessario all'erogazione del servizio o fino a richiesta di cancellazione dell'account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">4. Diritti dell'utente</h2>
              <p className="text-foreground">Puoi in qualsiasi momento chiedere:</p>
              <ul className="list-disc pl-6 space-y-1 text-foreground">
                <li>accesso, rettifica o cancellazione dei dati,</li>
                <li>limitazione o opposizione al trattamento,</li>
                <li>portabilità dei dati.</li>
              </ul>
              <p className="text-foreground mt-3">
                Per esercitare i tuoi diritti scrivi a{" "}
                <a href="mailto:support@noparrot.app" className="text-primary underline">
                  support@noparrot.app
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">5. Hosting e AI</h2>
              <p className="text-foreground">
                NOPARROT utilizza Lovable Cloud per l'hosting e OpenAI API per i test di comprensione.
                I contenuti inviati all'AI non vengono utilizzati per addestrare modelli e vengono processati in forma anonima.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">6. Cookie</h2>
              <p className="text-foreground">
                NOPARROT utilizza solo cookie tecnici per l'autenticazione e la personalizzazione.
                Non vengono usati cookie pubblicitari né di profilazione.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">7. Aggiornamenti</h2>
              <p className="text-foreground">
                La presente informativa può essere aggiornata. L'ultima versione è sempre consultabile su questa pagina.
              </p>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
}