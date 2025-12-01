import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Shield, MessageCircle } from "lucide-react";

interface FocusCommentChoiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAwareComment: () => void; // Con gate
  onQuickComment: () => void; // Senza gate
}

export const FocusCommentChoiceSheet = ({
  open, 
  onOpenChange, 
  onAwareComment, 
  onQuickComment
}: FocusCommentChoiceSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto bg-[#0E141A] border-white/10">
        <div className="space-y-4 py-4">
          <h3 className="text-xl font-bold text-white text-center">
            Come vuoi commentare?
          </h3>
          
          <Button 
            onClick={() => {
              onAwareComment();
              onOpenChange(false);
            }}
            className="w-full h-auto py-4 flex-col items-start gap-1 bg-primary/20 hover:bg-primary/30 border border-primary/30"
          >
            <div className="flex items-center gap-2 w-full">
              <Shield className="w-5 h-5 text-primary" />
              <span className="font-semibold text-white">Commento Consapevole</span>
            </div>
            <span className="text-xs text-gray-400 text-left">
              Leggi l'approfondimento e rispondi a 3 domande per un badge verificato
            </span>
          </Button>
          
          <Button 
            onClick={() => {
              onQuickComment();
              onOpenChange(false);
            }}
            variant="outline"
            className="w-full h-auto py-4 flex-col items-start gap-1 bg-white/5 hover:bg-white/10"
          >
            <div className="flex items-center gap-2 w-full">
              <MessageCircle className="w-5 h-5 text-white" />
              <span className="font-semibold text-white">Commento Rapido</span>
            </div>
            <span className="text-xs text-gray-400 text-left">
              Commenta subito senza verifica
            </span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
