interface MentionTextProps {
  text: string;
}

export const MentionText = ({ text }: MentionTextProps) => {
  const parts = text.split(/(@\w+)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          return (
            <span
              key={index}
              className="text-primary hover:underline cursor-pointer"
            >
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
};
