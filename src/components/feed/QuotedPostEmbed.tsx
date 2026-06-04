import React, { useState, useEffect } from "react";
import { Play, ExternalLink, Youtube, Linkedin, Disc } from "lucide-react";
import { cn, getDisplayUsername, decodeHTMLEntities } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { useArticlePreview } from "@/hooks/useArticlePreview";
import { VoicePlayer } from "@/components/media/VoicePlayer";

interface QuotedPostEmbedProps {
  post?: any; // The original post object (can be Post or quoted_post)
  quotedPost?: any; // For compatibility
  onPress?: () => void;
  onNavigate?: () => void;
  onClick?: () => void;
  className?: string;
  parentSources?: string[];
}

const getHostnameFromUrl = (url: string | undefined): string => {
  if (!url) return '';
  try {
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    return new URL(urlWithProtocol).hostname.replace('www.', '');
  } catch {
    return '';
  }
};

const extractYoutubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const useCountdown = (expiresAt: string | null | undefined) => {
  const [countdown, setCountdown] = useState('');
  
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) { setCountdown('Chiusa'); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      if (h > 24) setCountdown(`${Math.floor(h / 24)}g ${h % 24}h`);
      else setCountdown(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return countdown;
};

const CompactHeader: React.FC<{ post: any }> = ({ post }) => {
  const author = post.author || { username: "unknown", full_name: "Utente sconosciuto", avatar_url: null };
  const timeAgo = post.created_at && !isNaN(new Date(post.created_at).getTime())
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: it })
    : 'poco fa';

  const avatarContent = () => {
    if (author.avatar_url) {
      return (
        <img
          src={author.avatar_url}
          alt={author.full_name || author.username}
          className="w-full h-full object-cover"
        />
      );
    }
    const initial = (author.full_name || author.username).charAt(0).toUpperCase();
    return (
      <div className="w-full h-full flex items-center justify-center text-white font-bold text-[10px] bg-primary/20">
        <span className="text-primary">{initial}</span>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="w-7 h-7 rounded-full overflow-hidden bg-white/5 flex-shrink-0">
        {avatarContent()}
      </div>
      <div className="flex items-center gap-1 min-w-0">
        <span className="font-semibold text-white text-xs truncate max-w-[120px]">
          {author.full_name || getDisplayUsername(author.username)}
        </span>
        <span className="text-white/40 text-[10px]">·</span>
        <span className="text-white/40 text-[10px] whitespace-nowrap">{timeAgo}</span>
      </div>
    </div>
  );
};

const VoiceEmbed: React.FC<{ post: any }> = ({ post }) => {
  const voice = post.voice_post;
  const imageUrl = post.media?.[0]?.url || post.preview_img;
  
  if (!voice) return null;

  return (
    <div className="flex flex-col gap-2 mt-1">
      <div className="flex items-center">
        <span className="h-5 px-2 text-[10px] rounded-full font-bold tracking-wide inline-flex items-center uppercase border border-primary/20 bg-primary/5 text-primary">
          🎙 VOICECAST
        </span>
      </div>
      {post.title && (
        <h3 className="font-bold text-white text-sm leading-snug">
          {post.title}
        </h3>
      )}
      <div className="w-full">
        <VoicePlayer
          compact
          audioUrl={voice.audio_url}
          durationSeconds={voice.duration_seconds}
          waveformData={voice.waveform_data}
          hideTranscriptButton
        />
      </div>
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="w-full max-h-[120px] object-cover rounded-lg border border-white/5 mt-1"
        />
      )}
    </div>
  );
};

const ChallengeEmbed: React.FC<{ post: any }> = ({ post }) => {
  const challenge = post.challenge;
  const voice = challenge?.voice_post || post.voice_post;
  const countdown = useCountdown(challenge?.expires_at);
  const isExpired = challenge?.expires_at ? new Date(challenge.expires_at) < new Date() : false;
  const imageUrl = post.media?.[0]?.url || post.preview_img;

  if (!challenge) return null;

  const totalVotes = (challenge.votes_for || 0) + (challenge.votes_against || 0);
  const pctFor = totalVotes > 0 ? Math.round((challenge.votes_for / totalVotes) * 100) : 50;
  const pctAgainst = totalVotes > 0 ? Math.round((challenge.votes_against / totalVotes) * 100) : 50;

  return (
    <div className="flex flex-col gap-2 mt-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="h-5 px-2 text-[10px] rounded-full font-bold tracking-wide inline-flex items-center uppercase border border-rose-500/20 bg-rose-500/5 text-rose-500">
          ⚡ CHALLENGE
        </span>
        {countdown && (
          <span className="text-[10px] text-white/40 font-medium">
            · {isExpired ? 'Chiusa' : `Scade tra ${countdown}`}
          </span>
        )}
      </div>

      {challenge.title && (
        <h3 className="font-bold text-white text-sm leading-snug">
          {challenge.title}
        </h3>
      )}

      {voice && (
        <div className="w-full">
          <VoicePlayer
            compact
            audioUrl={voice.audio_url}
            durationSeconds={voice.duration_seconds}
            waveformData={voice.waveform_data}
            hideTranscriptButton
          />
        </div>
      )}

      {/* Polarization Bar compatto */}
      <div className="mt-1">
        <div className="flex justify-between items-center text-[9px] font-bold text-white/40 mb-1 px-0.5">
          <span>A FAVORE ({pctFor}%)</span>
          <span>CONTRO ({pctAgainst}%)</span>
        </div>
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
          <div style={{ width: `${pctFor}%`, background: 'linear-gradient(90deg, #0A7AFF, #3D9AFF)' }} />
          <div style={{ width: `${pctAgainst}%`, background: 'linear-gradient(90deg, #F5C842, #FFD464)' }} />
        </div>
      </div>

      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="w-full max-h-[120px] object-cover rounded-lg border border-white/5 mt-1"
        />
      )}
    </div>
  );
};

const YouTubeEmbed: React.FC<{ post: any; articlePreview: any }> = ({ post, articlePreview }) => {
  const videoId = extractYoutubeVideoId(post.shared_url);
  const title = articlePreview?.title || post.shared_title || post.title || 'Video YouTube';
  const thumbnailUrl = videoId 
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : (articlePreview?.image || post.preview_img);

  return (
    <div className="flex flex-col gap-2 mt-1">
      <div className="flex items-center gap-1.5 text-[10px] text-red-500 font-bold uppercase">
        <Youtube className="w-3.5 h-3.5 fill-red-500 text-red-500" />
        <span>YouTube</span>
      </div>

      {thumbnailUrl && (
        <div className="relative aspect-video max-h-[180px] w-full rounded-lg overflow-hidden border border-white/5 bg-black/40 group">
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <div className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
              <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>
      )}

      <h3 className="font-semibold text-white text-xs leading-snug line-clamp-2">
        {decodeHTMLEntities(title)}
      </h3>
    </div>
  );
};

const SpotifyEmbed: React.FC<{ post: any; articlePreview: any }> = ({ post, articlePreview }) => {
  const title = articlePreview?.title || post.shared_title || post.title || 'Traccia';
  const subtitle = articlePreview?.description || '';
  const albumArt = articlePreview?.image || post.preview_img;

  return (
    <div className="flex flex-col gap-2 mt-1">
      <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold uppercase">
        <Disc className="w-3.5 h-3.5 text-emerald-500" />
        <span>VINILE</span>
      </div>

      <div className="flex items-center gap-3 bg-white/5 border border-white/5 p-2.5 rounded-lg">
        {albumArt ? (
          <img
            src={albumArt}
            alt=""
            className="w-12 h-12 rounded object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded bg-emerald-500/10 flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
            <Disc className="w-6 h-6 text-emerald-500" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white text-xs truncate leading-snug">
            {decodeHTMLEntities(title)}
          </p>
          {subtitle && (
            <p className="text-[10px] text-white/50 truncate mt-0.5">
              {decodeHTMLEntities(subtitle)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const IlPuntoEmbed: React.FC<{ post: any }> = ({ post }) => {
  const sourcesCount = post.sources?.length || 0;
  const category = post.category || 'Generale';

  return (
    <div className="flex flex-col gap-1.5 mt-1">
      <div className="flex items-center">
        <span className="h-5 px-2 text-[10px] rounded-full font-bold tracking-wide inline-flex items-center uppercase border border-sky-500/20 bg-sky-500/5 text-sky-500">
          ◉ SINTESI EDITORIALE
        </span>
      </div>
      
      {post.title && (
        <h3 className="font-bold text-white text-sm leading-snug">
          {post.title}
        </h3>
      )}
      
      <p className="text-[10px] text-white/50">
        {sourcesCount} {sourcesCount === 1 ? 'fonte' : 'fonti'} · {category}
      </p>
    </div>
  );
};

const SocialEmbed: React.FC<{ post: any; articlePreview: any; platform: string }> = ({ post, articlePreview, platform }) => {
  const text = post.content || articlePreview?.description || '';
  const title = articlePreview?.title || post.shared_title || post.title || '';
  const imageUrl = articlePreview?.image || post.preview_img || (post.media?.[0]?.url);

  const getPlatformDetails = () => {
    if (platform === 'linkedin') {
      return {
        label: 'Post da LinkedIn',
        icon: <Linkedin className="w-3.5 h-3.5 fill-blue-600 text-blue-600" />,
        colorClass: 'text-blue-500'
      };
    }
    return {
      label: 'Post da X',
      icon: <span className="font-bold text-xs select-none">𝕏</span>,
      colorClass: 'text-white'
    };
  };

  const details = getPlatformDetails();

  return (
    <div className="flex flex-col gap-2 mt-1">
      <div className="flex items-center gap-1.5 text-[10px] text-white/60 font-bold uppercase">
        {details.icon}
        <span>{details.label}</span>
      </div>

      {title && (
        <h4 className="font-semibold text-white text-xs leading-snug">
          {decodeHTMLEntities(title)}
        </h4>
      )}

      {text && (
        <p className="text-[11px] text-white/70 line-clamp-2 leading-relaxed">
          {decodeHTMLEntities(text)}
        </p>
      )}

      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="w-full max-h-[140px] object-cover rounded-lg border border-white/5 mt-1"
        />
      )}
    </div>
  );
};

const ArticleEmbed: React.FC<{ post: any; articlePreview: any }> = ({ post, articlePreview }) => {
  const hostname = getHostnameFromUrl(post.shared_url || articlePreview?.url);
  const title = articlePreview?.title || post.shared_title || post.title || 'Articolo';
  const description = articlePreview?.description || post.content || '';
  const imageUrl = articlePreview?.image || post.preview_img || (post.media?.[0]?.url);

  const getTrustDots = (band: string | null | undefined) => {
    if (band === 'ALTO') return <span className="text-emerald-400">●●●</span>;
    if (band === 'MEDIO') return <span className="text-amber-400">●●○</span>;
    if (band === 'BASSO') return <span className="text-red-400">●○○</span>;
    return <span className="text-white/30">○○○</span>;
  };

  const faviconUrl = hostname ? `https://www.google.com/s2/favicons?sz=64&domain=${hostname}` : null;

  return (
    <div className="flex flex-col gap-2 mt-1">
      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider">
        {faviconUrl && (
          <img
            src={faviconUrl}
            alt=""
            className="w-3.5 h-3.5 rounded-sm object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        <span className="text-white/60 font-semibold truncate max-w-[120px]">{hostname || 'Fonte'}</span>
        <span className="text-white/30">·</span>
        <span className="text-white/60">
          Trust {getTrustDots(post.trust_level)}
        </span>
      </div>

      <h3 className="font-bold text-white text-xs leading-snug line-clamp-2">
        {decodeHTMLEntities(title)}
      </h3>

      {description && (
        <p className="text-[11px] text-white/60 line-clamp-2 leading-relaxed">
          {decodeHTMLEntities(description)}
        </p>
      )}

      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="w-full max-h-[140px] object-cover rounded-lg border border-white/5 mt-1"
        />
      )}
    </div>
  );
};

const StandardEmbed: React.FC<{ post: any }> = ({ post }) => {
  const imageUrl = post.media?.[0]?.url || post.preview_img;
  const description = post.content || '';

  return (
    <div className="flex flex-col gap-2 mt-1">
      {post.title && (
        <h3 className="font-bold text-white text-sm leading-snug">
          {post.title}
        </h3>
      )}

      {description && (
        <p className="text-xs text-white/70 line-clamp-2 leading-relaxed">
          {description}
        </p>
      )}

      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="w-full max-h-[200px] object-cover rounded-lg border border-white/5 mt-1"
        />
      )}
    </div>
  );
};

export const QuotedPostEmbed: React.FC<QuotedPostEmbedProps> = ({
  post: directPost,
  quotedPost: compatPost,
  onPress,
  onNavigate,
  onClick,
  className
}) => {
  const post = directPost || compatPost;
  const navigateFn = onPress || onNavigate || onClick;

  const { data: articlePreview } = useArticlePreview(post?.shared_url);

  if (!post) return null;

  const postType = post.post_type;
  
  const isIlPunto = post.author?.username === 'ilpunto' || post.author?.username === 'npe_ilpunto' || post.author?.username === 'Il Punto' || post.author?.id === 'system';
  const isVoice = postType === 'voice' || postType === 'voicecast' || !!post.voice_post;
  const isChallenge = postType === 'challenge' || !!post.challenge;
  
  const platform = articlePreview?.platform || getHostnameFromUrl(post.shared_url);
  const isYoutube = platform === 'youtube' || post.shared_url?.includes('youtube.com') || post.shared_url?.includes('youtu.be');
  const isSpotify = platform === 'spotify' || post.shared_url?.includes('spotify.com');
  const isLinkedIn = platform === 'linkedin' || post.shared_url?.includes('linkedin.com');
  const isTwitter = platform === 'twitter' || post.shared_url?.includes('twitter.com') || post.shared_url?.includes('x.com');
  const isArticle = !!post.shared_url && !isYoutube && !isSpotify && !isLinkedIn && !isTwitter && !isIlPunto;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        navigateFn?.();
      }}
      className={cn(
        "border border-white/10 rounded-xl p-3 bg-white/[0.03] backdrop-blur-sm cursor-pointer hover:bg-white/[0.06] active:opacity-80 transition-all select-none",
        className
      )}
    >
      {/* Header */}
      <CompactHeader post={post} />

      {/* Content based on type */}
      {isVoice && <VoiceEmbed post={post} />}
      {isChallenge && <ChallengeEmbed post={post} />}
      {!isVoice && !isChallenge && isYoutube && <YouTubeEmbed post={post} articlePreview={articlePreview} />}
      {!isVoice && !isChallenge && isSpotify && <SpotifyEmbed post={post} articlePreview={articlePreview} />}
      {!isVoice && !isChallenge && isIlPunto && <IlPuntoEmbed post={post} />}
      {!isVoice && !isChallenge && (isLinkedIn || isTwitter) && <SocialEmbed post={post} articlePreview={articlePreview} platform={isLinkedIn ? 'linkedin' : 'twitter'} />}
      {!isVoice && !isChallenge && isArticle && <ArticleEmbed post={post} articlePreview={articlePreview} />}
      {!isVoice && !isChallenge && !isYoutube && !isSpotify && !isIlPunto && !isLinkedIn && !isTwitter && !isArticle && <StandardEmbed post={post} />}
    </div>
  );
};
