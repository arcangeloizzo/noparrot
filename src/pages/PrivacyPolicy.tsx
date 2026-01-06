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
                Arcangelo Izzo<br />
                Email: <a href="mailto:support@noparrot.app" className="text-primary underline">support@noparrot.app</a>
              </p>
            </section>

            {/* 2. Dove sono i dati */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">2. Dove sono i tuoi dati</h3>
              <p className="text-muted-foreground">
                NoParrot utilizza Supabase (USA – AWS us-east-1). I dati possono essere trattati negli Stati Uniti.
              </p>
              <p className="text-muted-foreground">
                Il trasferimento è coperto da:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>EU–US Data Privacy Framework</li>
                <li>Standard Contractual Clauses (SCC)</li>
              </ul>
            </section>

            {/* 3. Cosa raccogliamo */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">3. Cosa raccogliamo</h3>
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

            {/* 4. Profilazione */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">4. Profilazione (Cognitive Density)</h3>
              <p className="text-muted-foreground">
                NoParrot crea un profilo di interessi basato sulle tue interazioni.
              </p>
              <p className="text-muted-foreground font-medium mt-3">Serve per:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>personalizzare il feed</li>
                <li>suggerire contenuti</li>
                <li>(solo con consenso) annunci</li>
              </ul>
              <p className="text-muted-foreground font-medium mt-3">Hai il diritto di:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>visualizzarlo</li>
                <li>esportarlo</li>
                <li>disattivarlo</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                <strong>Se lo disattivi:</strong> il feed non è personalizzato e non tracciamo interessi.
              </p>
            </section>

            {/* 5. AI */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">5. AI e automazione</h3>
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

            {/* 6. Terze parti */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">6. Terze parti (sub-processor)</h3>
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

            {/* 7. Diritti */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">7. I tuoi diritti</h3>
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
                <a href="mailto:support@noparrot.app" className="text-primary underline">support@noparrot.app</a>.
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
