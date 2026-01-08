import { X } from "lucide-react";
import { CognitiveNebulaCanvas } from "./CognitiveNebulaCanvas";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface NebulaExpandedSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cognitiveDensity: Record<string, number>;
}

export const NebulaExpandedSheet = ({ 
  open, 
  onOpenChange, 
  cognitiveDensity 
}: NebulaExpandedSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="bg-[#0E1419] border-t border-white/10 rounded-t-3xl h-[85vh] px-4 pb-8 pt-4"
      >
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-foreground text-lg">Nebulosa Cognitiva</SheetTitle>
            <button 
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground text-left">
            La mappa dei tuoi percorsi di comprensione
          </p>
        </SheetHeader>

        <div className="h-[calc(100%-80px)] flex items-center justify-center">
          <CognitiveNebulaCanvas data={cognitiveDensity} />
        </div>
      </SheetContent>
    </Sheet>
  );
};
