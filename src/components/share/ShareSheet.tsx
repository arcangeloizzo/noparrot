import { Share2, Users } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { haptics } from "@/lib/haptics";

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onShareToFeed: () => void;
  onShareToFriend: () => void;
}

export const ShareSheet = ({
  isOpen,
  onClose,
  onShareToFeed,
  onShareToFriend
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
        </div>
      </SheetContent>
    </Sheet>
  );
};
