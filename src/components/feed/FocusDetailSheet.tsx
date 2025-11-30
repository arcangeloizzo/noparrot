import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Source {
  icon: string;
  name: string;
  url?: string;
}

interface FocusDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'daily' | 'interest';
  category?: string;
  title: string;
  summary: string;
  sources: Source[];
}

export const FocusDetailSheet = ({
  open,
  onOpenChange,
  type,
  category,
  title,
  summary,
  sources,
}: FocusDetailSheetProps) => {
  const isDailyFocus = type === 'daily';
  const badgeBg = isDailyFocus ? 'bg-[#0A7AFF]' : 'bg-[#A98FF8]/20';
  const badgeText = isDailyFocus ? 'text-white' : 'text-[#A98FF8]';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] bg-[#0E141A] border-white/10 overflow-y-auto"
      >
        <SheetHeader className="space-y-4 pb-6 border-b border-white/10">
          <Badge className={cn(badgeBg, badgeText, "font-semibold px-3 py-1 border-0 w-fit")}>
            {isDailyFocus ? '🌍 DAILY FOCUS' : `🧠 PER TE: ${category?.toUpperCase() || 'GENERALE'}`}
          </Badge>
          <SheetTitle className="text-white text-2xl font-bold text-left leading-tight">
            {title}
          </SheetTitle>
        </SheetHeader>
        
        <div className="py-6 space-y-6">
          <div>
            <h4 className="text-gray-400 text-sm font-semibold mb-2">Sintesi</h4>
            <p className="text-gray-200 text-base leading-relaxed">{summary}</p>
          </div>
          
          <div>
            <h4 className="text-gray-400 text-sm font-semibold mb-3">
              Fonti ({sources.length})
            </h4>
            <div className="space-y-2">
              {sources.map((source, idx) => (
                <a
                  key={idx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg transition-colors",
                    "bg-white/5 hover:bg-white/10",
                    !source.url && "opacity-50 pointer-events-none"
                  )}
                >
                  <span className="text-2xl">{source.icon}</span>
                  <span className="text-white font-medium flex-1">{source.name}</span>
                  {source.url && (
                    <ExternalLink className="w-5 h-5 text-gray-400" />
                  )}
                </a>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
