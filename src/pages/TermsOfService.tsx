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
            <Logo className="w-auto h-12" />
          </div>
        </div>

        <Card className="p-8">
          <h1 className="text-3xl font-bold mb-2">Termini di Servizio</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Versione: v2.0 — Ultimo aggiornamento: 6 gennaio 2026
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
                Per utilizzare NoParrot devi avere almeno 16 anni. Se hai meno di 16 anni non puoi creare un account né utilizzare i servizi.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Questo requisito è conforme all'Art. 8 del GDPR sul consenso digitale dei minori nell'Unione Europea.
              </p>
              <p className="text-foreground mt-3">
                NoParrot si basa sulle informazioni fornite dall'utente. 
                Fornire una data di nascita falsa costituisce violazione dei Termini 
                e può comportare la sospensione immediata dell'account.
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
                Puoi cancellare in qualsiasi momento il tuo account dalla sezione Impostazioni → Privacy 
                o scrivendo a{" "}
                <a href="mailto:noparrot.info@gmail.com" className="text-primary underline">noparrot.info@gmail.com</a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">7. Moderazione dei contenuti e restrizioni (DSA Art. 14, 17)</h2>
              <p className="text-foreground">
                NoParrot si riserva il diritto di limitare, rimuovere o rendere inaccessibili contenuti 
                che violino i presenti Termini, la legge applicabile o i diritti di terzi. In particolare possono essere rimossi contenuti che:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-foreground text-sm">
                <li>Contengano incitamento all'odio, alla violenza o alla discriminazione</li>
                <li>Costituiscano spam, phishing o contenuti ingannevoli</li>
                <li>Violino la proprietà intellettuale di terzi</li>
                <li>Contengano materiale illegale ai sensi del diritto dell'Unione Europea</li>
                <li>Siano stati segnalati e confermati come inappropriati</li>
              </ul>
              <p className="text-foreground mt-3">
                In caso di rimozione di un contenuto o di restrizione dell'account, l'utente riceverà 
                una comunicazione via email con: (a) la decisione adottata, (b) il motivo della restrizione 
                e (c) le modalità per presentare un reclamo.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">8. Sistema di reclamo e appello (DSA Art. 20)</h2>
              <p className="text-foreground">
                Se ritieni che una decisione di moderazione (rimozione di contenuto, sospensione dell'account 
                o altra restrizione) sia stata presa in modo errato, puoi presentare un reclamo gratuito 
                scrivendo a{" "}
                <a href="mailto:noparrot.info@gmail.com" className="text-primary underline">noparrot.info@gmail.com</a>{" "}
                entro 6 mesi dalla decisione.
              </p>
              <p className="text-foreground mt-2">
                Il reclamo verrà esaminato da un membro del team entro 15 giorni lavorativi. 
                La decisione sull'appello sarà comunicata via email con le relative motivazioni. 
                In caso di conferma della rimozione, potrai rivolgerti a un organismo di risoluzione 
                extragiudiziale certificato o all'autorità giudiziaria competente.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-foreground">9. Modifiche ai termini</h2>
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
