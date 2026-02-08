import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

export default function CookiePolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-4 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Cookie Policy</h1>
        </div>
      </header>

      <main className="p-4 pb-24 max-w-2xl mx-auto space-y-6">
        <div className="flex justify-center py-4">
          <Logo size="lg" />
        </div>

        <Card>
          <CardContent className="pt-6 space-y-8">
            {/* Introduzione */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">Cookie e tecnologie simili</h3>
              <p className="text-muted-foreground">
                NoParrot utilizza <strong>solo cookie tecnici</strong> necessari per il funzionamento dell'app.
              </p>
              <p className="text-muted-foreground">
                <strong>Non utilizziamo cookie di tracciamento o profilazione di terze parti.</strong>
              </p>
            </section>

            {/* Cookie utilizzati */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold">Cookie utilizzati</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium">Nome</th>
                      <th className="text-left py-2 font-medium">Scopo</th>
                      <th className="text-left py-2 font-medium">Durata</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border/50">
                      <td className="py-2 font-mono text-xs">sb-*-auth-token</td>
                      <td className="py-2">Autenticazione utente</td>
                      <td className="py-2">Sessione</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono text-xs">sidebar:state</td>
                      <td className="py-2">Preferenza UI sidebar</td>
                      <td className="py-2">7 giorni</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Local Storage */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold">Local Storage</h3>
              <p className="text-muted-foreground">
                Utilizziamo il Local Storage del browser per:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium">Chiave</th>
                      <th className="text-left py-2 font-medium">Scopo</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border/50">
                      <td className="py-2 font-mono text-xs">sb-*-auth-token</td>
                      <td className="py-2">Token di autenticazione</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 font-mono text-xs">recentSearches</td>
                      <td className="py-2">Cronologia ricerche locali</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 font-mono text-xs">hasSeenOnboarding</td>
                      <td className="py-2">Flag onboarding completato</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono text-xs">pendingConsent</td>
                      <td className="py-2">Consenso pre-login temporaneo</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Nessun tracking */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">Nessun tracciamento di terze parti</h3>
              <p className="text-muted-foreground">
                NoParrot <strong>non utilizza</strong>:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>Google Analytics</li>
                <li>Meta Pixel</li>
                <li>Hotjar o strumenti di session recording</li>
                <li>SDK pubblicitari</li>
                <li>Cookie di terze parti per profilazione</li>
              </ul>
            </section>

            {/* Come gestire */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">Come gestire i cookie</h3>
              <p className="text-muted-foreground">
                Puoi gestire i cookie dalle impostazioni del tuo browser. 
                Disabilitare i cookie tecnici potrebbe impedire il corretto funzionamento dell'app.
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
