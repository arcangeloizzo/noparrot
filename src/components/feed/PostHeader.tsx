import { getDisplayUsername } from "@/lib/utils";

interface PostHeaderProps {
  displayName: string;
  username: string;
  timestamp?: string;
  label?: string;
  avatarUrl?: string | null;
}

export const PostHeader = ({
  displayName,
  username,
  timestamp,
  label,
  avatarUrl
}: PostHeaderProps) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex items-start w-full">
      {/* Avatar - solo se passato */}
      {avatarUrl !== null && (
        <div className="flex-shrink-0 mr-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-base font-semibold text-primary-foreground">
              {getInitials(displayName)}
            </div>
          )}
        </div>
      )}

      {/* Main info */}
      <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
        {/* Name & username row */}
        <div className="flex items-baseline gap-1 min-w-0 flex-wrap">
          <span className="font-bold text-base text-foreground truncate max-w-[140px]">
            {displayName}
          </span>
          <span className="text-base text-muted-foreground truncate">
            @{getDisplayUsername(username)}
          </span>
        </div>

        {/* Meta info - sempre su una riga */}
        <div className="flex items-center gap-1.5 flex-shrink-0 text-sm text-muted-foreground whitespace-nowrap">
          {timestamp && <span>{timestamp}</span>}
          {timestamp && label && <span>·</span>}
          {label && (
            <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${
              label === 'Condiviso' 
                ? 'bg-primary/10 text-primary' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
