import { useState, memo } from "react";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MentionText } from "@/components/feed/MentionText";
import { FullTextModal } from "@/components/feed/FullTextModal";

export interface ExpandableTextAuthor {
  name: string;
  username?: string;
  avatar?: string | null;
}

export interface ExpandableTextSource {
  hostname?: string;
  url?: string;
}

interface ExpandableTextProps {
  /** Text content to display */
  content: string;
  /** Maximum characters before truncating (default 400) */
  maxLength?: number;
  /** Maximum lines using CSS line-clamp (alternative to maxLength) */
  maxLines?: number;
  /** Author info for modal header */
  author?: ExpandableTextAuthor;
  /** Source info for caption modals */
  source?: ExpandableTextSource;
  /** Whether to show expand button (default true) */
  showExpandButton?: boolean;
  /** Custom label for expand button (default "Mostra tutto") */
  expandLabel?: string;
  /** Use icon with label in button */
  showExpandIcon?: boolean;
  /** Variant for styling context */
  variant?: 'post' | 'caption' | 'editorial' | 'quoted';
  /** Additional className for the text */
  className?: string;
  /** Additional className for the expand button */
  buttonClassName?: string;
  /** Callback when text is expanded - useful for analytics */
  onExpand?: () => void;
  /** Use MentionText for rendering (default true) */
  useMentions?: boolean;
  /** Post data for modal action bar (optional) */
  post?: {
    id: string;
    reactions?: { hearts?: number; comments?: number };
    user_reactions?: { has_hearted?: boolean; has_bookmarked?: boolean };
    shares_count?: number;
  };
  /** Action handlers for modal */
  actions?: {
    onHeart?: (e: React.MouseEvent) => void;
    onComment?: () => void;
    onBookmark?: (e: React.MouseEvent) => void;
    onShare?: () => void;
  };
}

const ExpandableTextInner = ({
  content,
  maxLength = 400,
  maxLines,
  author,
  source,
  showExpandButton = true,
  expandLabel = "Mostra tutto",
  showExpandIcon = false,
  variant = 'post',
  className,
  buttonClassName,
  onExpand,
  useMentions = true,
  post,
  actions,
}: ExpandableTextProps) => {
  const [showModal, setShowModal] = useState(false);

  // Determine if text should be truncated
  const shouldTruncate = maxLines 
    ? false // line-clamp handles it via CSS
    : content.length > maxLength;

  // Truncated text content
  const displayText = shouldTruncate && !maxLines
    ? content.slice(0, maxLength).trim() + '...'
    : content;

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowModal(true);
    onExpand?.();
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  // For line-clamp variant, we need to check overflow dynamically
  // For simplicity, if maxLines is set and content is long enough, show button
  const showButton = showExpandButton && (shouldTruncate || (maxLines && content.length > 150));

  const renderText = (text: string) => {
    if (useMentions) {
      return <MentionText content={text} />;
    }
    return text;
  };

  // Line clamp classes based on maxLines
  const lineClampClass = maxLines ? `line-clamp-${maxLines}` : '';

  return (
    <>
      <div className={cn("relative", className)}>
        {/* Main text */}
        <div className={cn(lineClampClass, "whitespace-pre-wrap")}>
          {renderText(displayText)}
        </div>

        {/* Expand button */}
        {showButton && (
          <button
            onClick={handleExpandClick}
            className={cn(
              "mt-2 text-sm text-primary font-semibold hover:underline inline-flex items-center gap-1.5 transition-colors",
              buttonClassName
            )}
          >
            <span>{expandLabel}</span>
            {showExpandIcon && <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Full text modal */}
      <FullTextModal
        isOpen={showModal}
        onClose={handleCloseModal}
        content={content}
        author={author}
        source={source}
        variant={variant}
        post={post}
        actions={actions}
      />
    </>
  );
};

export const ExpandableText = memo(ExpandableTextInner);
ExpandableText.displayName = 'ExpandableText';
