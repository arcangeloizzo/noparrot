import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getDisplayUsername } from '@/lib/utils';

interface MentionTextProps {
  text?: string;
  content?: string;
}

export const MentionText = ({ text, content }: MentionTextProps) => {
  const navigate = useNavigate();
  const textContent = text || content || '';
  const parts = textContent.split(/(@[\w@.]+)/g);

  const handleMentionClick = async (e: React.MouseEvent, username: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Cerca l'utente nel database per ottenere l'ID
    const cleanUsername = username.replace(/^@/, '');
    const { data: profile } = await supabase
      .from('public_profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();
    
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
            <span
              key={index}
              className="text-primary hover:underline cursor-pointer"
              onClick={(e) => handleMentionClick(e, part)}
            >
              @{cleanName}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
};
