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
  /** Phase 4.6c — topic-tag associato al post (per filtro topic). */
  topic_id?: string | null;
  topic_label?: string | null;
  title?: string | null;
  voice_title?: string | null;
  voice_body?: string | null;
  challenge_title?: string | null;
  challenge_body?: string | null;
  media_url?: string | null;
  media_type?: string | null;
}

interface DiaryEntryProps {
  entry: DiaryEntryData;
}

const getEntryTypeConfig = (entry: DiaryEntryData) => {
  // Challenge
  if (entry.challenge_title) {
    return { 
      icon: PenLine, 
      color: 'text-[#E41E52]', 
      bgColor: 'bg-[#E41E52]/10',
      label: 'Challenge' 
    };
  }
  // Voicecast
  if (entry.voice_title) {
    return { 
      icon: Music, 
      color: 'text-[#0A7AFF]', 
      bgColor: 'bg-[#0A7AFF]/10',
      label: 'Voicecast' 
    };
  }

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

const getEntryTitle = (entry: DiaryEntryData): string => {
  // Challenge
  if (entry.challenge_title) return entry.challenge_title;
  // Voicecast
  if (entry.voice_title) return entry.voice_title;
  // Post normale
  if (entry.title) return entry.title;
  // Fallback: primi 80 caratteri del content
  if (entry.content) return entry.content.slice(0, 80) + (entry.content.length > 80 ? '...' : '');
  // Nessun contenuto
  return '';
};

export const DiaryEntry = ({ entry }: DiaryEntryProps) => {
  const navigate = useNavigate();
  const config = getEntryTypeConfig(entry);
  const Icon = config.icon;

  const displayText = getEntryTitle(entry);
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
        {entry.preview_img ? (
          <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden">
            <img 
              src={entry.preview_img} 
              alt="" 
              className="w-full h-full object-cover"
            />
          </div>
        ) : (entry.media_url && entry.media_type?.startsWith('image/')) ? (
          <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden">
            <img 
              src={entry.media_url} 
              alt="" 
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};