import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-4 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Privacy Policy</h1>
        </div>
      </header>

      <main className="p-4 pb-24 max-w-2xl mx-auto space-y-6">
        <div className="flex justify-center py-4">
          <Logo size="lg" />
        </div>

        <Card>
          <CardContent className="pt-6 space-y-8">
            {/* Header */}
            <div className="text-center border-b border-border pb-6">
              <h2 className="text-2xl font-bold mb-2">PRIVACY POLICY</h2>
              <p className="text-muted-foreground">NoParrot</p>
              <p className="text-sm text-muted-foreground mt-2">Versione 2.0 — 6 gennaio 2026</p>
            </div>

            {/* 1. Titolare */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">1. Titolare del trattamento</h3>
              <p className="text-muted-foreground">
                Arcangelo Izzo (persona fisica)<br />
                Email: <a href="mailto:noparrot.info@gmail.com" className="text-primary underline">noparrot.info@gmail.com</a>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Per qualsiasi richiesta privacy puoi scrivere a{" "}
                <a href="mailto:noparrot.info@gmail.com" className="text-primary underline">noparrot.info@gmail.com</a>.
                Se non ricevi risposta entro un tempo ragionevole, puoi esercitare i tuoi diritti 
                anche tramite l'Autorità Garante competente.
              </p>
            </section>

            {/* 2. Base giuridica */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">2. Base giuridica del trattamento</h3>
              <p className="text-muted-foreground">
                Trattiamo i dati per:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li><strong>Esecuzione del servizio</strong> — creazione account, uso del feed, pubblicazione contenuti, messaggi</li>
                <li><strong>Sicurezza e prevenzione abusi</strong> — protezione account, logging essenziale, anti-spam</li>
                <li><strong>Consenso</strong> — solo per funzionalità opzionali come annunci basati sugli interessi, se attivati</li>
              </ul>
            </section>

            {/* 3. Dove sono i dati */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">3. Dove sono i tuoi dati</h3>
              <p className="text-muted-foreground">
                NoParrot utilizza Supabase (AWS us-east-1, USA). Alcuni dati possono essere trattati negli Stati Uniti.
              </p>
              <p className="text-muted-foreground mt-2">
                Quando avvengono trasferimenti extra-UE, utilizziamo meccanismi legali applicabili 
                (ad es. EU–US Data Privacy Framework e/o Standard Contractual Clauses, a seconda del fornitore).
              </p>
              <p className="text-muted-foreground mt-2">
                I principali importatori dei dati sono Supabase Inc. e Google LLC 
                in qualità di fornitori di infrastruttura e intelligenza artificiale.
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                Puoi richiedere informazioni sul meccanismo applicato ai principali fornitori 
                scrivendo a{" "}
                <a href="mailto:noparrot.info@gmail.com" className="text-primary underline">noparrot.info@gmail.com</a>.
              </p>
            </section>

            {/* 4. Età minima */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">4. Età minima</h3>
              <p className="text-muted-foreground">
                NoParrot è riservato a utenti con almeno 16 anni. Durante la registrazione 
                richiediamo la data di nascita e blocchiamo automaticamente la creazione 
                dell'account se l'età dichiarata è inferiore a 16 anni.
              </p>
            </section>

            {/* 5. Cosa raccogliamo */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">5. Cosa raccogliamo</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium">Categoria</th>
                      <th className="text-left py-2 font-medium">Dati</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border/50">
                      <td className="py-2">Account</td>
                      <td className="py-2">email, username, data di nascita, avatar</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Attività</td>
                      <td className="py-2">post, commenti, reazioni, salvataggi</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Cognitivi</td>
                      <td className="py-2">mappa di interessi (Cognitive Density)</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Tecnici</td>
                      <td className="py-2">IP, sessioni, notifiche push</td>
                    </tr>
                    <tr>
                      <td className="py-2">Gate</td>
                      <td className="py-2">risposte, tempi, punteggi</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 6. Profilazione */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">6. Profilazione (Cognitive Density)</h3>
              <p className="text-muted-foreground">
                NoParrot può creare una mappa di interessi basata su interazioni 
                (es. letture, commenti, reazioni) per personalizzare alcune sezioni ("Per Te").
              </p>
              <p className="text-muted-foreground mt-3">
                Puoi disattivare in qualsiasi momento il feed personalizzato 
                dalle <strong>Impostazioni → Privacy</strong>.
              </p>
              <p className="text-muted-foreground mt-3">
                <strong>Se lo disattivi:</strong> il feed non è personalizzato 
                e non aggiorniamo più la mappa di interessi.
              </p>
              <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border">
                <p className="text-sm font-medium text-foreground mb-2">Art. 22 GDPR</p>
                <p className="text-sm text-muted-foreground">
                  Questa profilazione non produce effetti giuridici né effetti equivalenti 
                  o significativamente rilevanti sull'utente; serve solo a organizzare 
                  e suggerire contenuti e, se attivato, annunci basati sugli interessi.
                </p>
              </div>
            </section>

            {/* 7. Messaggi privati */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">7. Messaggi privati</h3>
              <p className="text-muted-foreground">
                I messaggi privati tra utenti sono trattati come comunicazioni riservate.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>Non vengono inviati ai sistemi di intelligenza artificiale</li>
                <li>Sono protetti tramite crittografia TLS durante la trasmissione</li>
                <li>Puoi eliminare i messaggi dalla tua conversazione in qualsiasi momento</li>
              </ul>
            </section>

            {/* 8. Conservazione */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">8. Conservazione dei dati</h3>
              <p className="text-muted-foreground">
                Conserviamo i dati dell'account e i contenuti finché l'account è attivo 
                o finché non richiedi la cancellazione.
              </p>
              <p className="text-muted-foreground mt-2">
                Alcuni dati tecnici e cache (es. trascrizioni/copie tecniche usate per 
                generare domande) possono essere conservati per un periodo limitato 
                e poi eliminati automaticamente.
              </p>
            </section>

            {/* 9. AI */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">9. AI e automazione</h3>
              <p className="text-muted-foreground">
                Utilizziamo modelli Google Gemini tramite Lovable AI Gateway per:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>classificazione</li>
                <li>domande</li>
                <li>Trust Score</li>
                <li>sintesi</li>
              </ul>
              <p className="text-muted-foreground mt-3 font-medium">I tuoi dati:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>non sono usati per addestramento</li>
                <li>non sono conservati dai provider AI</li>
              </ul>
            </section>

            {/* 10. Terze parti */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">10. Terze parti (sub-processor)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium">Servizio</th>
                      <th className="text-left py-2 font-medium">Ruolo</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border/50">
                      <td className="py-2">Supabase</td>
                      <td className="py-2">Database & Auth</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Lovable</td>
                      <td className="py-2">App & AI Gateway</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Google (Gemini)</td>
                      <td className="py-2">AI</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Firecrawl</td>
                      <td className="py-2">Estrazione articoli</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Jina</td>
                      <td className="py-2">Estrazione articoli</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Supadata</td>
                      <td className="py-2">Trascrizioni YouTube</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Spotify</td>
                      <td className="py-2">Metadata</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Genius</td>
                      <td className="py-2">Lyrics</td>
                    </tr>
                    <tr>
                      <td className="py-2">Google</td>
                      <td className="py-2">RSS & Cache</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 11. Diritti */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">11. I tuoi diritti</h3>
              <p className="text-muted-foreground">Hai diritto a:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>accesso</li>
                <li>rettifica</li>
                <li>cancellazione</li>
                <li>esportazione</li>
                <li>opposizione alla profilazione</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                Puoi esercitarli da <strong>Impostazioni → Privacy</strong> o scrivendo a{" "}
                <a href="mailto:noparrot.info@gmail.com" className="text-primary underline">noparrot.info@gmail.com</a>.
              </p>
            </section>

            {/* Footer */}
            <div className="pt-6 border-t border-border text-center text-xs text-muted-foreground">
              <p>NoParrot — Versione 2.0</p>
              <p>Ultimo aggiornamento: 6 gennaio 2026</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}