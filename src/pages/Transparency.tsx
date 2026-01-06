import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

export default function Transparency() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-4 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Trasparenza su AI e fonti</h1>
        </div>
      </header>

      <main className="p-4 pb-24 max-w-2xl mx-auto space-y-6">
        <div className="flex justify-center py-4">
          <Logo size="lg" />
        </div>

        <Card>
          <CardContent className="pt-6 space-y-8">
            {/* Come funziona il feed */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold">Come funziona il feed</h3>
              <p className="text-muted-foreground">
                NoParrot mostra tre tipi di contenuti:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium">Tipo</th>
                      <th className="text-left py-2 font-medium">Personalizzato</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border/50">
                      <td className="py-2">Daily Focus (Il Punto)</td>
                      <td className="py-2">No</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Interest Focus (Per Te)</td>
                      <td className="py-2">Sì</td>
                    </tr>
                    <tr>
                      <td className="py-2">Post utenti</td>
                      <td className="py-2">No</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-muted-foreground">
                Il feed personalizzato usa:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>categorie di interesse</li>
                <li>attività consapevoli (letture, commenti)</li>
              </ul>
              <p className="text-muted-foreground font-medium">
                Puoi disattivarlo in ogni momento dalle Impostazioni → Privacy.
              </p>
            </section>

            {/* Come funziona l'AI */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold">Come funziona l'AI</h3>
              <p className="text-muted-foreground">L'AI:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li><strong>non decide</strong> cosa è vero</li>
                <li><strong>non decide</strong> cosa pensare</li>
                <li>aiuta a classificare e sintetizzare</li>
              </ul>
              <div className="bg-muted/50 rounded-lg p-4 mt-4">
                <p className="text-sm text-muted-foreground italic">
                  ⚠️ Può sbagliare. Consulta sempre le fonti originali per verificare le informazioni.
                </p>
              </div>
            </section>

            {/* Trust Score */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold">Trust Score</h3>
              <p className="text-muted-foreground">
                Il Trust Score indica l'affidabilità della <strong>fonte</strong>, non la verità del contenuto.
              </p>
              <p className="text-muted-foreground">
                È calcolato automaticamente in base a:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>reputazione del dominio</li>
                <li>trasparenza editoriale</li>
                <li>storico verificabilità</li>
              </ul>
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
