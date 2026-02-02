import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getDisplayUsername } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

interface MentionTextProps {
  text?: string;
  content?: string;
}

// Parsa i marker Markdown in React nodes
const parseMarkdown = (text: string, startKey: number): React.ReactNode[] => {
  const segments: React.ReactNode[] = [];
  const combinedRegex = /(\*\*[^*]+\*\*|_[^_]+_|~[^~]+~)/g;
  let lastIndex = 0;
  let key = startKey;
  let match;

  while ((match = combinedRegex.exec(text)) !== null) {
    // Testo prima del match
    if (match.index > lastIndex) {
      segments.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }

    const matchedText = match[0];
    if (matchedText.startsWith('**')) {
      segments.push(<strong key={key++}>{matchedText.slice(2, -2)}</strong>);
    } else if (matchedText.startsWith('_')) {
      segments.push(<em key={key++}>{matchedText.slice(1, -1)}</em>);
    } else if (matchedText.startsWith('~')) {
      segments.push(<u key={key++}>{matchedText.slice(1, -1)}</u>);
    }

    lastIndex = combinedRegex.lastIndex;
  }

  // Testo rimanente
  if (lastIndex < text.length) {
    segments.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return segments.length > 0 ? segments : [<span key={startKey}>{text}</span>];
};

export const MentionText = ({ text, content }: MentionTextProps) => {
  const navigate = useNavigate();
  const textContent = text || content || '';
  const parts = textContent.split(/(@[\w@.]+)/g);

  const handleMentionClick = async (e: React.MouseEvent, username: string) => {
    // CRITICAL: Ferma completamente l'evento per evitare propagazione
    e.preventDefault();
    e.stopPropagation();
    
    haptics.light();
    
    // Pulisci lo username per la ricerca
    const cleanUsername = username.replace(/^@/, '');
    
    // Prima prova match esatto
    let { data: profile } = await supabase
      .from('public_profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();
    
    // Se non trovato, prova match flessibile (potrebbe essere troncato o con email)
    if (!profile?.id) {
      const { data: flexProfile } = await supabase
        .from('public_profiles')
        .select('id, username')
        .ilike('username', `${cleanUsername}%`)
        .limit(1)
        .maybeSingle();
      
      profile = flexProfile;
    }
    
    if (profile?.id) {
      navigate(`/profile/${profile.id}`);
    }
  };

  let keyCounter = 0;

  return (
    <>
      {parts.map((part) => {
        if (part.startsWith('@')) {
          const displayName = part.slice(1);
          const cleanName = getDisplayUsername(displayName);
          return (
            <button
              key={keyCounter++}
              type="button"
              className="text-primary font-semibold bg-white/10 px-1.5 py-0.5 rounded-md hover:bg-white/15 active:scale-95 transition-all cursor-pointer inline-block border-0 mx-0.5 my-0.5"
              onClick={(e) => handleMentionClick(e, part)}
              onTouchEnd={(e) => {
                e.stopPropagation();
              }}
            >
              @{cleanName}
            </button>
          );
        }
        // Parsa Markdown per il testo non-menzione
        const parsed = parseMarkdown(part, keyCounter);
        keyCounter += parsed.length;
        return parsed;
      })}
    </>
  );
};
