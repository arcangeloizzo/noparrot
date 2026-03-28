import { Share2, Users } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { haptics } from "@/lib/haptics";

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onShareToFeed: () => void;
  onShareToFriend: () => void;
  onShareNatively?: () => void;
}

export const ShareSheet = ({
  isOpen,
  onClose,
  onShareToFeed,
  onShareToFriend,
  onShareNatively
}: ShareSheetProps) => {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-auto">
        <SheetHeader>
          <SheetTitle>Dove vuoi condividere?</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-2 mt-4 pb-4">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14"
            onClick={() => {
              haptics.light();
              onShareToFeed();
              onClose();
            }}
          >
            <Share2 className="h-5 w-5" />
            <div className="text-left">
              <div className="font-semibold">Condividi nel Feed</div>
              <div className="text-xs text-muted-foreground">
                Pubblica questo contenuto nel tuo feed
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14"
            onClick={() => {
              haptics.light();
              onShareToFriend();
              onClose();
            }}
          >
            <Users className="h-5 w-5" />
            <div className="text-left">
              <div className="font-semibold">Invia ad un amico</div>
              <div className="text-xs text-muted-foreground">
                Condividi tramite messaggio privato
              </div>
            </div>
          </Button>

          {onShareNatively && (
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-14"
              onClick={() => {
                haptics.light();
                onShareNatively();
                onClose();
              }}
            >
              <div className="h-5 w-5 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
              </div>
              <div className="text-left">
                <div className="font-semibold">Condividi all'esterno</div>
                <div className="text-xs text-muted-foreground">
                  Altre app o copia il link
                </div>
              </div>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
