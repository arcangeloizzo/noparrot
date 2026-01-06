import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

interface WhyAmISeeingThisProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
}

export const WhyAmISeeingThis = ({ open, onOpenChange, category }: WhyAmISeeingThisProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Perché vedo questo?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <p className="font-medium text-foreground mb-1">Categoria</p>
            <p className="text-primary font-semibold">{category || 'Generale'}</p>
          </div>
          
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <p className="font-medium text-foreground mb-1">Motivazione</p>
            <p>
              Questo contenuto è mostrato perché hai interagito spesso con contenuti della categoria <strong className="text-foreground">"{category || 'Generale'}"</strong>.
            </p>
          </div>

          <div className="pt-3 border-t border-border space-y-2">
            <p className="text-xs">
              NoParrot analizza le tue interazioni consapevoli (letture, commenti, condivisioni) per proporti contenuti rilevanti.
            </p>
            <button
              onClick={() => {
                onOpenChange(false);
                navigate("/legal/transparency");
              }}
              className="text-xs text-primary underline hover:no-underline"
            >
              Scopri di più sulla trasparenza del feed
            </button>
          </div>
        </div>
        <DialogClose asChild>
          <button className="w-full mt-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors">
            Chiudi
          </button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
};
