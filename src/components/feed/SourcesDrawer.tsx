import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SourcesDrawerSkeleton } from "./skeletons";

interface Source {
  icon: string;
  name: string;
  url?: string;
  title?: string;
  description?: string;
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
      <SheetContent 
        side="bottom" 
        className="h-[85vh] bg-[#0E141A] border-t border-white/10 rounded-t-3xl p-0"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0E141A] border-b border-white/5 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold text-lg">
              {sources.length} {sources.length === 1 ? 'Fonte' : 'Fonti'}
            </h3>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
        
        {/* Sources List - show skeleton when sources empty/loading */}
        {sources.length === 0 ? (
          <SourcesDrawerSkeleton />
        ) : (
          <div className="overflow-y-auto h-[calc(85vh-80px)] px-6 py-4">
            <div className="space-y-3">
              {sources.map((source, idx) => (
                <a 
                  key={idx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "block p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-200 border border-white/5",
                    highlightIndex === idx && "ring-2 ring-primary border-primary/50 bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-4">
                    {/* Source Number Badge */}
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                        <span className="text-primary font-bold text-sm">{idx + 1}</span>
                      </div>
                    </div>
                    
                    {/* Source Name */}
                    <h4 className="flex-1 font-semibold text-white text-[15px]">
                      {source.name}
                    </h4>
                    
                    {/* External Link Icon */}
                    <ExternalLink className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
