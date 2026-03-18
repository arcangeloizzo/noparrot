import { useState } from 'react';
import { Flag } from 'lucide-react';
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

const REPORT_REASONS = [
  { value: 'spam', label: '🚫 Spam', desc: 'Contenuto ripetitivo, promozione non richiesta' },
  { value: 'inappropriate', label: '⚠️ Inappropriato', desc: 'Contenuto offensivo, molesto o volgare' },
  { value: 'illegal', label: '🔴 Illegale', desc: 'Violazione di legge, incitamento all\'odio, minacce' },
  { value: 'misinformation', label: '📰 Disinformazione', desc: 'Notizie false presentate come fatti' },
  { value: 'other', label: '📝 Altro', desc: 'Altro motivo (specifica nei dettagli)' },
] as const;

interface ReportContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId?: string;
  commentId?: string;
}

export function ReportContentDialog({ open, onOpenChange, postId, commentId }: ReportContentDialogProps) {
  const { user } = useAuth();
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !selectedReason) return;
    setIsSubmitting(true);

    try {
      const insertData: Record<string, unknown> = {
        reporter_id: user.id,
        reason: selectedReason,
        details: details.trim() || null,
      };
      if (postId) insertData.post_id = postId;
      if (commentId) insertData.comment_id = commentId;

      const { error } = await (supabase as any)
        .from('content_reports')
        .insert(insertData);

      if (error) {
        if (error.code === '23505') {
          toast.info('Hai già segnalato questo contenuto');
        } else {
          toast.error('Errore nella segnalazione');
        }
      } else {
        toast.success('Contenuto segnalato. Grazie per la collaborazione.');
      }
    } catch {
      toast.error('Errore nella segnalazione');
    }

    setIsSubmitting(false);
    setSelectedReason('');
    setDetails('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-orange-400" />
            Segnala contenuto
          </DialogTitle>
          <DialogDescription>
            Seleziona il motivo della segnalazione. La tua identità resterà riservata.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {REPORT_REASONS.map((reason) => (
            <button
              key={reason.value}
              onClick={() => setSelectedReason(reason.value)}
              className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                selectedReason === reason.value
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <div className="font-medium text-sm">{reason.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{reason.desc}</div>
            </button>
          ))}
        </div>

        {selectedReason && (
          <div className="space-y-2 mt-2">
            <Label htmlFor="report-details" className="text-sm">
              Dettagli aggiuntivi (opzionale)
            </Label>
            <Textarea
              id="report-details"
              placeholder="Descrivi il problema in modo più specifico..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button 
            variant="ghost" 
            onClick={() => { onOpenChange(false); setSelectedReason(''); setDetails(''); }}
          >
            Annulla
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedReason || isSubmitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? 'Invio...' : 'Invia segnalazione'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
