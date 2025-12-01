import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const getFaviconUrl = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    } catch {
      return '';
    }
  };

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] bg-[#0E141A] border-t border-white/10 rounded-t-3xl p-0"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0E141A] border-b border-white/5 px-6 py-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {/* Favicon Stack */}
              <div className="flex -space-x-2">
                {sources.slice(0, 4).map((s, i) => (
                  <div 
                    key={i}
                    className="w-8 h-8 rounded-full bg-white/10 border-2 border-[#0E141A] flex items-center justify-center overflow-hidden"
                  >
                    {s.url ? (
                      <img 
                        src={getFaviconUrl(s.url)} 
                        alt=""
                        className="w-5 h-5"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-xs">{s.icon}</span>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Fonti</h3>
                <p className="text-gray-400 text-xs">{sources.length} {sources.length === 1 ? 'fonte' : 'fonti'}</p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
        
        {/* Sources List */}
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
                <div className="flex items-start gap-4">
                  {/* Source Number Badge */}
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                      <span className="text-primary font-bold text-sm">{idx + 1}</span>
                    </div>
                  </div>
                  
                  {/* Source Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h4 className="font-semibold text-white text-[15px] leading-snug line-clamp-2 mb-2">
                      {source.title || source.name}
                    </h4>
                    
                    {/* Description */}
                    {source.description && (
                      <p className="text-[13px] text-gray-400 leading-relaxed line-clamp-2 mb-3">
                        {source.description}
                      </p>
                    )}
                    
                    {/* Domain Info */}
                    {source.url && (
                      <div className="flex items-center gap-2">
                        <img 
                          src={getFaviconUrl(source.url)} 
                          alt=""
                          className="w-4 h-4 rounded"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <span className="text-xs text-gray-500 font-medium">
                          {getHostname(source.url)}
                        </span>
                        <ExternalLink className="w-3 h-3 text-gray-600 ml-auto" />
                      </div>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
