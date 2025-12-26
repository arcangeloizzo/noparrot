import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Shield, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

export default function Transparency() {
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
          <h1 className="text-lg font-semibold">Trasparenza su AI e fonti</h1>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-6">
        {/* Logo */}
        <div className="flex justify-center py-4">
          <Logo size="md" />
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-6">
            {/* Section: Contenuti AI */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-lg font-bold">Contenuti AI</h2>
              </div>
              <div className="pl-11">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Alcuni contenuti (es. "Il Punto.") sono sintesi automatiche generate 
                  da sistemi di intelligenza artificiale e possono contenere inesattezze, 
                  omissioni o errori. <strong className="text-foreground">Invitiamo sempre 
                  a consultare le fonti originali.</strong>
                </p>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Section: Trust Score */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Shield className="w-5 h-5 text-green-400" />
                </div>
                <h2 className="text-lg font-bold">Trust Score</h2>
              </div>
              <div className="pl-11">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Il Trust Score indica esclusivamente l'affidabilità delle fonti citate, 
                  <strong className="text-foreground"> non la verità o la qualità del contenuto</strong>. 
                  È calcolato automaticamente e può contenere errori.
                </p>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Section: Percorso di comprensione */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Brain className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-lg font-bold">Percorso di comprensione</h2>
              </div>
              <div className="pl-11">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Il percorso di comprensione è uno strumento automatico che verifica 
                  la coerenza delle risposte rispetto a un contenuto, ma 
                  <strong className="text-foreground"> non garantisce la reale comprensione dell'utente</strong>.
                </p>
              </div>
            </div>

            {/* Version footer */}
            <div className="pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Versione: v1 — Ultimo aggiornamento: 26 dicembre 2025
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
