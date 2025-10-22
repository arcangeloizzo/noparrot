import { useState, useRef, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAddComment } from '@/hooks/useComments';
import { useAuth } from '@/contexts/AuthContext';
import { Post } from '@/hooks/usePosts';
import { getDisplayUsername } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { MediaUploadButton } from '@/components/media/MediaUploadButton';
import { MediaPreviewTray } from '@/components/media/MediaPreviewTray';
import { MentionDropdown } from './MentionDropdown';
import { MentionText } from './MentionText';
import { useUserSearch } from '@/hooks/useUserSearch';

interface CommentReplySheetProps {
  post: Post;
  parentComment?: any;
  isOpen: boolean;
  onClose: () => void;
}

export const CommentReplySheet = ({ post, parentComment, isOpen, onClose }: CommentReplySheetProps) => {
  const { user } = useAuth();
  const addComment = useAddComment();
  const [newComment, setNewComment] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: mentionUsers = [], isLoading: isSearching } = useUserSearch(mentionQuery);
  const { uploadMedia, uploadedMedia, removeMedia, clearMedia, isUploading } = useMediaUpload();

  const { data: currentUserProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!newComment.trim() || addComment.isPending) return;

    console.log('[CommentReply] Submitting comment:', {
      postId: post.id,
      parentId: parentComment?.id || null,
      level: parentComment ? (parentComment.level || 0) + 1 : 0,
      parentComment
    });

    const commentId = await addComment.mutateAsync({
      postId: post.id,
      content: newComment.trim(),
      parentId: parentComment?.id || null,
      level: parentComment ? (parentComment.level || 0) + 1 : 0
    });

    if (uploadedMedia.length > 0 && commentId) {
      for (let i = 0; i < uploadedMedia.length; i++) {
        await supabase.from('comment_media').insert({
          comment_id: commentId,
          media_id: uploadedMedia[i].id,
          order_idx: i
        });
      }
    }

    setNewComment('');
    clearMedia();
    onClose();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setNewComment(value);
    setCursorPosition(cursorPos);

    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }
  };

  const handleSelectMention = (user: { username: string }) => {
    const textBeforeCursor = newComment.slice(0, cursorPosition);
    const textAfterCursor = newComment.slice(cursorPosition);
    
    const beforeMention = textBeforeCursor.replace(/@\w*$/, '');
    const newText = `${beforeMention}@${user.username} ${textAfterCursor}`;
    const newCursorPos = beforeMention.length + user.username.length + 2;
    
    setNewComment(newText);
    setShowMentions(false);
    setMentionQuery('');
    setSelectedMentionIndex(0);
    
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        setCursorPosition(newCursorPos);
      }
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserAvatar = (avatarUrl: string | null | undefined, name: string | undefined, username?: string) => {
    const displayName = name || username || 'U';
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-10 h-10 rounded-full object-cover"
        />
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
        {getInitials(displayName)}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between z-20">
        <button
          onClick={onClose}
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold">Indietro</span>
        <Button
          onClick={handleSubmit}
          disabled={!newComment.trim() || addComment.isPending}
          size="sm"
          className="rounded-full px-4 font-bold"
        >
          Posta
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Post originale o commento a cui si risponde */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex-shrink-0">
                {getUserAvatar(
                  parentComment ? parentComment.author.avatar_url : post.author.avatar_url,
                  parentComment ? parentComment.author.full_name : post.author.full_name,
                  parentComment ? parentComment.author.username : post.author.username
                )}
              </div>
              {!parentComment && <div className="w-0.5 bg-border flex-1 my-1" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">
                  {parentComment 
                    ? (parentComment.author.full_name || getDisplayUsername(parentComment.author.username))
                    : (post.author.full_name || getDisplayUsername(post.author.username))
                  }
                </span>
                <span className="text-muted-foreground text-xs">
                  @{getDisplayUsername(parentComment ? parentComment.author.username : post.author.username)}
                </span>
              </div>
              <div className="text-sm">
                <MentionText content={parentComment ? parentComment.content : post.content} />
              </div>
              {!parentComment && (
                <div className="mt-3 text-muted-foreground text-sm">
                  In risposta a <span className="text-primary">@{getDisplayUsername(post.author.username)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Form di risposta */}
        <div className="px-4 py-3">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              {currentUserProfile && getUserAvatar(
                currentUserProfile.avatar_url,
                currentUserProfile.full_name,
                currentUserProfile.username
              )}
            </div>
            <div className="flex-1 min-w-0">
              <textarea
                ref={textareaRef}
                value={newComment}
                onChange={handleTextChange}
                onKeyDown={(e) => {
                  if (!showMentions || mentionUsers.length === 0) {
                    return;
                  }
                  
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedMentionIndex((prev) => 
                      (prev + 1) % mentionUsers.length
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedMentionIndex((prev) => 
                      (prev - 1 + mentionUsers.length) % mentionUsers.length
                    );
                  } else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSelectMention(mentionUsers[selectedMentionIndex]);
                  } else if (e.key === 'Escape') {
                    setShowMentions(false);
                  }
                }}
                placeholder="Posta la tua risposta"
                className="w-full bg-transparent border-none focus:outline-none resize-none text-[15px] min-h-[120px] placeholder:text-muted-foreground leading-normal"
                maxLength={500}
              />
              
              {showMentions && (
                <MentionDropdown
                  users={mentionUsers}
                  selectedIndex={selectedMentionIndex}
                  onSelect={handleSelectMention}
                  isLoading={isSearching}
                />
              )}
              
              <MediaPreviewTray
                media={uploadedMedia}
                onRemove={removeMedia}
              />
              
              <div className="flex items-center gap-2 mt-3">
                <MediaUploadButton
                  type="image"
                  onFilesSelected={(files) => uploadMedia(files, 'image')}
                  maxFiles={4}
                  disabled={isUploading}
                />
                <MediaUploadButton
                  type="video"
                  onFilesSelected={(files) => uploadMedia(files, 'video')}
                  maxFiles={1}
                  disabled={isUploading}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
