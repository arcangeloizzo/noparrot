import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Source {
  icon: string;
  name: string;
  url?: string;
}

interface SourcesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: Source[];
  highlightIndex?: number;
}

export const SourcesDrawer = ({ open, onOpenChange, sources, highlightIndex }: SourcesDrawerProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[60vh] bg-[#0E141A] border-white/10">
        <div className="flex items-center gap-2 mb-6">
          {sources.slice(0, 5).map((s, i) => (
            <span key={i} className="text-lg">{s.icon}</span>
          ))}
          <span className="font-semibold text-white">{sources.length} Fonti</span>
        </div>
        
        <div className="space-y-3 overflow-y-auto max-h-[calc(60vh-80px)]">
          {sources.map((source, idx) => (
            <a 
              key={idx}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "block p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors",
                highlightIndex === idx && "ring-2 ring-primary"
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold text-sm">[{idx}]</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white line-clamp-2 text-sm">{source.name}</h4>
                  {source.url && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{new URL(source.url).hostname}</span>
                    </div>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
