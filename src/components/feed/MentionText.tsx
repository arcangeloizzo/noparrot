import { getDisplayUsername } from '@/lib/utils';

interface MentionTextProps {
  text?: string;
  content?: string;
}

export const MentionText = ({ text, content }: MentionTextProps) => {
  const textContent = text || content || '';
  const parts = textContent.split(/(@[\w@.]+)/g);

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
