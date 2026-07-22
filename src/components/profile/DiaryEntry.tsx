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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Row } from "@/components/shell/Row";
import { getTerritoryColor } from "@/lib/territory";

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

  const rib = getTerritoryColor(entry.category) ?? "rgba(255,255,255,0.14)";

  return (
    <Row
      as="button"
      ribColor={rib}
      onClick={() => navigate(`/post/${entry.id}`)}
      ariaLabel={`Apri voce del diario: ${displayText || config.label}`}
    >
      {/* Icona tipizzata 34px */}
      <div
        className={cn("flex-shrink-0 flex items-center justify-center", config.bgColor)}
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
        }}
      >
        <Icon className={cn("w-4 h-4", config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="row-title line-clamp-2" style={{ lineHeight: 1.35 }}>
          {displayText}
        </p>
        <div
          className="flex items-center gap-2 mt-1"
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9.5,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--txt-3)",
          }}
        >
          <span className={cn(config.color)} style={{ fontWeight: 600 }}>
            {config.label}
          </span>
          {entry.category && (
            <>
              <span aria-hidden style={{ opacity: 0.35 }}>·</span>
              <span>{entry.category}</span>
            </>
          )}
          <span aria-hidden style={{ opacity: 0.35 }}>·</span>
          <span>{timeAgo}</span>
        </div>
      </div>

      {/* Thumbnail if available */}
      {entry.preview_img ? (
        <div
          className="flex-shrink-0 overflow-hidden"
          style={{ width: 52, height: 52, borderRadius: 12 }}
        >
          <img src={entry.preview_img} alt="" className="w-full h-full object-cover" />
        </div>
      ) : entry.media_url && entry.media_type?.startsWith("image/") ? (
        <div
          className="flex-shrink-0 overflow-hidden"
          style={{ width: 52, height: 52, borderRadius: 12 }}
        >
          <img src={entry.media_url} alt="" className="w-full h-full object-cover" />
        </div>
      ) : null}
    </Row>
  );
};