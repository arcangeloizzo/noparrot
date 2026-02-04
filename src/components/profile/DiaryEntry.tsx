import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { 
  PenLine, 
  Repeat2, 
  FileCheck, 
  Newspaper, 
  Music, 
  Linkedin, 
  Play, 
  Globe 
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DiaryEntryType = 'original' | 'reshared' | 'gated' | 'editorial';

export interface DiaryEntryData {
  id: string;
  content: string;
  shared_title?: string | null;
  shared_url?: string | null;
  quoted_post_id?: string | null;
  sources?: unknown;
  preview_img?: string | null;
  created_at: string | null;
  passed_gate?: boolean;
  category?: string | null;
  type: DiaryEntryType;
}

interface DiaryEntryProps {
  entry: DiaryEntryData;
}

const getEntryTypeConfig = (entry: DiaryEntryData) => {
  // Detect platform from URL
  const url = entry.shared_url?.toLowerCase() || '';
  
  if (url.includes('spotify.com') || url.includes('open.spotify')) {
    return { 
      icon: Music, 
      color: 'text-[#1DB954]', 
      bgColor: 'bg-[#1DB954]/10',
      label: 'Spotify' 
    };
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return { 
      icon: Play, 
      color: 'text-[#FF0000]', 
      bgColor: 'bg-[#FF0000]/10',
      label: 'YouTube' 
    };
  }
  if (url.includes('linkedin.com')) {
    return { 
      icon: Linkedin, 
      color: 'text-[#0A66C2]', 
      bgColor: 'bg-[#0A66C2]/10',
      label: 'LinkedIn' 
    };
  }

  // Entry types
  switch (entry.type) {
    case 'reshared':
      return { 
        icon: Repeat2, 
        color: 'text-purple-400', 
        bgColor: 'bg-purple-400/10',
        label: 'Ricondiviso' 
      };
    case 'gated':
      return { 
        icon: FileCheck, 
        color: 'text-orange-400', 
        bgColor: 'bg-orange-400/10',
        label: 'Percorso completato' 
      };
    case 'editorial':
      return { 
        icon: Newspaper, 
        color: 'text-primary-blue', 
        bgColor: 'bg-primary-blue/10',
        label: 'Il Punto' 
      };
    default:
      return { 
        icon: PenLine, 
        color: 'text-emerald-400', 
        bgColor: 'bg-emerald-400/10',
        label: 'Post originale' 
      };
  }
};

export const DiaryEntry = ({ entry }: DiaryEntryProps) => {
  const navigate = useNavigate();
  const config = getEntryTypeConfig(entry);
  const Icon = config.icon;

  const displayText = entry.shared_title || entry.content;
  const timeAgo = entry.created_at 
    ? formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: it })
    : '';

  return (
    <div
      onClick={() => navigate(`/post/${entry.id}`)}
      className={cn(
        "p-4 rounded-xl cursor-pointer transition-all duration-200",
        "bg-card border border-border hover:border-border/50",
        "hover:bg-muted active:scale-[0.98]"
      )}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className={cn("flex-shrink-0 p-2 rounded-lg", config.bgColor)}>
          <Icon className={cn("w-4 h-4", config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground line-clamp-2 leading-snug mb-1.5">
            {displayText}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("font-medium", config.color)}>{config.label}</span>
            {entry.category && (
              <>
                <span className="text-border">•</span>
                <span>{entry.category}</span>
              </>
            )}
            <span className="text-border">•</span>
            <span>{timeAgo}</span>
          </div>
        </div>

        {/* Thumbnail if available */}
        {entry.preview_img && (
          <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden">
            <img 
              src={entry.preview_img} 
              alt="" 
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );
};