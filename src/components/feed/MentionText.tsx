import { getDisplayUsername } from '@/lib/utils';

interface MentionTextProps {
  text: string;
}

export const MentionText = ({ text }: MentionTextProps) => {
  const parts = text.split(/(@[\w@.]+)/g);

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
