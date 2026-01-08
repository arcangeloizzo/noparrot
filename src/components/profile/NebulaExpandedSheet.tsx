import { ChevronDown } from "lucide-react";
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
        className="bg-[#0A0F14] border-t border-white/10 rounded-t-3xl h-[85vh] px-4 pb-8 pt-4"
        hideClose
      >
        {/* Urban texture background */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.06] rounded-t-3xl"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundSize: '150px 150px',
          }}
        />

        <SheetHeader className="mb-4 relative z-10">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-foreground text-lg font-semibold">Nebulosa Cognitiva</SheetTitle>
            <button 
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground text-left">
            La mappa dei tuoi percorsi di comprensione
          </p>
        </SheetHeader>

        <div className="h-[calc(100%-80px)] flex items-center justify-center relative z-10">
          <CognitiveNebulaCanvas data={cognitiveDensity} />
        </div>
      </SheetContent>
    </Sheet>
  );
};
