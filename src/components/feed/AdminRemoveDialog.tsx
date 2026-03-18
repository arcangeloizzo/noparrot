import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AdminRemoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetId: string;
  targetType: 'post' | 'comment';
  onSuccess?: () => void;
}

export function AdminRemoveDialog({ 
  open, 
  onOpenChange, 
  targetId, 
  targetType,
  onSuccess 
}: AdminRemoveDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-defined typical DSA Art 17 removal reasons for quick insertion
  const SUGGESTED_REASONS = [
    "Violazione DSA: Incitamento all'odio o bullismo",
    "Violazione ToS: Contenuto inappropriato o volgare",
    "Spam o promozione non autorizzata",
    "Disinformazione o informazioni fuorvianti gravi"
  ];

  const handleRemove = async () => {
    if (!user || !reason.trim()) {
      toast.error('La motivazione è obbligatoria');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await (supabase as any).rpc('admin_remove_content', {
        p_target_type: targetType,
        p_target_id: targetId,
        p_reason: reason.trim(),
        p_admin_id: user.id
      });

      if (error) {
        console.error('Admin removal error:', error);
        toast.error('Errore durante la rimozione');
      } else {
        toast.success('Contenuto rimosso con successo e utente notificato');
        onSuccess?.();
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Fatal admin removal error:', err);
      toast.error('Errore critico durante la rimozione');
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-red-900/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-5 h-5" />
            Rimozione Contenuto (Admin)
          </DialogTitle>
          <DialogDescription>
            Stai per rimuovere un {targetType === 'post' ? 'post' : 'commento'}. 
            Questa azione nasconderà il contenuto e invierà una notifica formale all'autore 
            con la motivazione inserita (DSA Art. 17).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="removal-reason" className="text-sm font-semibold">
              Motivazione della rimozione (Obbligatoria)
            </Label>
            <Textarea
              id="removal-reason"
              placeholder="Spiega perché il contenuto viene rimosso..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none min-h-[100px]"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Motivazioni rapide
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_REASONS.map((sr) => (
                <button
                  key={sr}
                  onClick={() => setReason(sr)}
                  className="text-left text-xs bg-muted hover:bg-muted/80 px-2.5 py-1.5 rounded-md transition-colors border border-transparent hover:border-border"
                >
                  {sr}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button 
            variant="ghost" 
            onClick={() => { onOpenChange(false); setReason(''); }}
            disabled={isSubmitting}
          >
            Annulla
          </Button>
          <Button
            onClick={handleRemove}
            disabled={!reason.trim() || isSubmitting}
            variant="destructive"
          >
            {isSubmitting ? 'Rimozione in corso...' : 'Conferma rimozione'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
