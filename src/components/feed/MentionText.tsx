import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getDisplayUsername } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

interface MentionTextProps {
  text?: string;
  content?: string;
}

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

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          const displayName = part.slice(1); // Rimuovi @
          const cleanName = getDisplayUsername(displayName);
          return (
            <button
              key={index}
              type="button"
              className="text-primary font-semibold bg-white/10 px-1.5 py-0.5 rounded-md hover:bg-white/15 active:scale-95 transition-all cursor-pointer inline-block border-0 mx-0.5 my-0.5"
              onClick={(e) => handleMentionClick(e, part)}
              onTouchEnd={(e) => {
                // Previeni ghost click su mobile
                e.stopPropagation();
              }}
            >
              @{cleanName}
            </button>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
};
