import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, Zap, Clock, ChevronLeft } from "lucide-react";

interface PostTypeChooserProps {
    onSelectType: (type: 'voice' | 'challenge', challengeData?: { durationHours: number }) => void;
    onBackToRecorder: () => void;
    audioDuration: number;
}

export const PostTypeChooser: React.FC<PostTypeChooserProps> = ({
    onSelectType,
    onBackToRecorder,
    audioDuration
}) => {
    const [selectedType, setSelectedType] = useState<'voice' | 'challenge' | null>(null);
    const [duration, setDuration] = useState<number>(48);

    const handlePublish = () => {
        if (selectedType === 'challenge') {
            onSelectType('challenge', { durationHours: duration });
        } else if (selectedType === 'voice') {
            onSelectType('voice');
        }
    };

    if (!selectedType) {
        return (
            <div className="flex flex-col items-center justify-center space-y-6 bg-secondary/20 p-6 rounded-xl border border-border/50 animate-in fade-in">
                <h3 className="font-semibold text-lg">Come vuoi pubblicarlo?</h3>

                <div className="flex flex-col gap-3 w-full">
                    <Button
                        variant="outline"
                        className="w-full justify-start h-16 px-4 bg-background hover:bg-muted"
                        onClick={() => setSelectedType('voice')}
                    >
                        <div className="bg-primary/20 p-2 rounded-full mr-3 border border-primary/30">
                            <Mic className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex flex-col items-start gap-1">
                            <span className="font-semibold uppercase">Voicecast</span>
                            <span className="text-xs text-muted-foreground font-normal">Pubblica nel feed per i tuoi follower</span>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full justify-start h-16 px-4 bg-background hover:bg-muted group"
                        onClick={() => setSelectedType('challenge')}
                    >
                        <div className="bg-destructive/10 p-2 rounded-full mr-3 border border-destructive/20 group-hover:bg-destructive/20 transition-colors">
                            <Zap className="h-5 w-5 text-destructive" />
                        </div>
                        <div className="flex flex-col items-start gap-1">
                            <span className="font-semibold text-destructive group-hover:text-destructive">Lancia una Challenge</span>
                            <span className="text-xs text-muted-foreground font-normal">Sfida la community sulle tue idee</span>
                        </div>
                    </Button>
                </div>

                <Button variant="ghost" onClick={onBackToRecorder} className="w-full text-muted-foreground">
                    Indietro
                </Button>
            </div>
        );
    }

    if (selectedType === 'challenge') {
        return (
            <div className="flex flex-col space-y-5 bg-background border rounded-xl p-5 animate-in slide-in-from-right-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedType(null)} className="h-8 w-8 -ml-2">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4 text-destructive" />
                        Dettagli Challenge
                    </div>
                </div>

                <div className="space-y-3 pt-2">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-muted-foreground" /> Durata della sfida
                    </label>
                    <div className="flex gap-2">
                        {[24, 48, 168].map(h => (
                            <Button
                                key={h}
                                variant={duration === h ? 'default' : 'outline'}
                                className={duration === h ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 flex-1" : "flex-1"}
                                onClick={() => setDuration(h)}
                            >
                                {h === 168 ? '7 giorni' : `${h}h`}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="bg-secondary/40 border p-3 rounded-lg text-sm flex gap-2 items-center text-muted-foreground mt-2">
                    <Zap className="h-8 w-8 text-destructive opacity-30 shrink-0" />
                    <p>L'audio di {Math.ceil(audioDuration)} secondi fungerà da argomento a sostegno della tua tesi. Potrai aggiungere il testo (max 30 parole) e un'immagine nella prossima schermata.</p>
                </div>

                <Button
                    className="w-full bg-destructive hover:bg-destructive/90 text-white mt-4"
                    size="lg"
                    onClick={handlePublish}
                >
                    Continua
                </Button>
            </div>
        );
    }

    // Quick confirmation for direct Voice Post
    return (
        <div className="flex flex-col space-y-6 bg-background border rounded-xl p-6 text-center animate-in slide-in-from-right-4">
            <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 text-primary">
                <Mic className="h-8 w-8" />
            </div>
            <div>
                <h3 className="font-semibold text-lg mb-1">VOICECAST pronto</h3>
                <p className="text-sm text-muted-foreground">
                    Potrai aggiungere eventuale testo (max 30 parole) e un'immagine di copertina nella schermata successiva.
                </p>
            </div>

            <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedType(null)}>
                    Annulla
                </Button>
                <Button onClick={handlePublish} className="flex-1">
                    Continua
                </Button>
            </div>
        </div>
    );
};
