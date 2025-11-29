import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Source {
  icon: string;
  name: string;
}

interface InsightCardProps {
  label: string;
  labelColor: string;
  title: string;
  summary: string;
  sources: Source[];
  sourceCount: number;
  trustScore: 'Alto' | 'Medio' | 'Basso';
  onAction?: () => void;
}

export const InsightCard = ({
  label,
  labelColor,
  title,
  summary,
  sources,
  sourceCount,
  trustScore,
  onAction
}: InsightCardProps) => {
  const trustColors = {
    Alto: 'text-emerald-400',
    Medio: 'text-amber-400',
    Basso: 'text-red-400'
  };

  return (
    <div className="bg-[#151F2B] border border-white/5 rounded-2xl p-5 space-y-4 hover:border-white/10 transition-colors">
      {/* Header: Badge + Trust Score */}
      <div className="flex items-center justify-between">
        <Badge 
          variant="outline" 
          className={`${labelColor} border-0 text-xs font-medium`}
        >
          {label}
        </Badge>
        <span className={`text-xs font-medium ${trustColors[trustScore]}`}>
          Trust: {trustScore}
        </span>
      </div>
      
      {/* Body */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-foreground leading-tight">
          {title}
        </h3>
        <p className="text-sm text-[#D1D5DB] leading-relaxed line-clamp-4">
          {summary}
        </p>
      </div>
      
      {/* Sources */}
      <div className="flex items-center gap-2 text-xs text-[#9AA3AB]">
        <div className="flex -space-x-2">
          {sources.slice(0, 3).map((source, idx) => (
            <div 
              key={idx}
              className="w-5 h-5 rounded-full bg-[#0E141A] border border-[#0E141A] flex items-center justify-center text-[10px]"
              title={source.name}
            >
              {source.icon}
            </div>
          ))}
        </div>
        <span>{sourceCount} fonti analizzate</span>
      </div>
      
      {/* Footer CTA */}
      <Button 
        variant="outline" 
        className="w-full border-white/10 text-white/80 hover:bg-white/5 hover:text-white"
        onClick={onAction}
      >
        Approfondisci e Parla
      </Button>
    </div>
  );
};
