import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, MessageCircle, Heart, Share2, Bookmark } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { MediaGallery } from "@/components/media/MediaGallery";
import { Post, useDeletePost, useToggleReaction } from "@/hooks/usePosts";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCreateThread } from "@/hooks/useMessageThreads";
import { useSendMessage } from "@/hooks/useMessages";
import { CommentsDrawer } from "@/components/feed/CommentsDrawer";
import { QuotedPostCard } from "./QuotedPostCard";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";

interface DesktopPostCardProps {
    post: Post;
    onRemove?: (postId: string) => void;
    onQuoteShare?: (post: Post) => void;
}

export const DesktopPostCard = ({ post, onRemove, onQuoteShare }: DesktopPostCardProps) => {
    const { user } = useAuth();
    const deletePost = useDeletePost();
    const toggleReaction = useToggleReaction();
    const [showComments, setShowComments] = useState(false);
    const isOwnPost = user?.id === post.author.id;
    const createThread = useCreateThread();
    const sendMessage = useSendMessage();
    const navigate = useNavigate();

    const handleLike = () => {
        toggleReaction.mutate({ postId: post.id, reactionType: 'heart' });
    };

    const handleBookmark = () => {
        toggleReaction.mutate({ postId: post.id, reactionType: 'bookmark' });
    };

    const handleDelete = () => {
        if (confirm("Sei sicuro di voler eliminare questo post?")) {
            deletePost.mutate(post.id, {
                onSuccess: () => onRemove?.(post.id)
            });
        }
    };

    const handleMessage = async () => {
        if (!user || !post.author?.id) return;
        try {
            const thread = await createThread.mutateAsync([post.author.id]);
            // Navigate or open chat
            toast.info("Chat aperta (funzionalità desktop in arrivo)");
        } catch (e) {
            toast.error("Errore nell'apertura della chat");
        }
    };

    const getInitials = (name: string) => {
        return name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
    };

    return (
        <Card className="mb-6 border-border/40 shadow-sm hover:shadow-md transition-shadow bg-card">
            <CardHeader className="flex flex-row items-center gap-4 p-4 pb-2 space-y-0">
                <Link to={`/profile/${post.author?.id}`}>
                    <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src={post.author?.avatar_url || ""} />
                        <AvatarFallback>{getInitials(post.author?.full_name || post.author?.username || "U")}</AvatarFallback>
                    </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <Link to={`/profile/${post.author?.id}`} className="font-semibold hover:underline truncate">
                            {post.author?.full_name || post.author?.username || "Utente"}
                        </Link>
                        <span className="text-muted-foreground text-xs">•</span>
                        <span className="text-muted-foreground text-xs">
                            {post.created_at && !isNaN(new Date(post.created_at).getTime())
                                ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: it })
                                : ""}
                        </span>
                    </div>
                    {post.author?.username && (
                        <p className="text-xs text-muted-foreground">@{post.author.username}</p>
                    )}
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {isOwnPost && (
                            <DropdownMenuItem onClick={handleDelete} className="text-red-500">
                                Elimina
                            </DropdownMenuItem>
                        )}
                        {!isOwnPost && (
                            <DropdownMenuItem onClick={handleMessage}>
                                Invia un messaggio
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>

            <CardContent className="p-4 pt-2 space-y-4">
                {/* Text Content */}
                {post.content && (
                    <div className="prose prose-sm dark:prose-invert max-w-none break-words whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                        {post.content}
                    </div>
                )}

                {/* Shared/Quoted Content Logic */}
                <div className="space-y-3">
                    {/* 1. Quoted Post - Use standard component */}
                    {post.quoted_post && (
                        <QuotedPostCard
                            quotedPost={post.quoted_post}
                            parentSources={post.shared_url ? [post.shared_url, ...(post.sources || [])] : (post.sources || [])}
                            onNavigate={() => navigate(`/post/${post.quoted_post.id}`)}
                            className="mt-2"
                        />
                    )}
                    {/* 2. Link Preview (if shared_url exists and not quoting) */}
                    {!post.quoted_post && post.shared_url && (post.shared_title || post.preview_img) && (
                        <a
                            href={post.shared_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block group rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-colors"
                        >
                            {post.preview_img && (
                                <div className="h-40 overflow-hidden relative">
                                    <img
                                        src={post.preview_img}
                                        alt={post.shared_title || "Link preview"}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>
                            )}
                            <div className="p-3 bg-card/50">
                                <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                                    {post.shared_title || post.shared_url}
                                </h4>
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                    {new URL(post.shared_url).hostname}
                                </p>
                            </div>
                        </a>
                    )}

                    {/* 3. Media Gallery */}
                    {post.media && post.media.length > 0 && (
                        <div className="rounded-xl overflow-hidden border border-border/50">
                            <MediaGallery
                                media={post.media}
                            />
                        </div>
                    )}
                </div>
            </CardContent>

            <CardFooter className="p-3 border-t border-border/30 flex justify-between items-center z-50">
                {/* Primary Share Button - Pill shape with consistent height */}
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onQuoteShare?.(post);
                    }}
                    className="h-9 px-4 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-full flex items-center gap-2 transition-all active:scale-95 border border-primary/10"
                >
                    <Logo variant="icon" size="sm" className="h-4 w-4" />
                    <span className="text-sm font-semibold leading-none">Condividi</span>
                    {(post.shares_count ?? 0) > 0 && (
                        <span className="text-xs opacity-70">({post.shares_count})</span>
                    )}
                </motion.button>

                {/* Action Icons - Uniform w-6 h-6, aligned on same axis */}
                <div
                    className="flex items-center gap-4 h-9 action-bar-zone bg-muted/30 px-4 rounded-full shadow-sm border border-border/50 dark:bg-transparent dark:px-0 dark:rounded-none dark:shadow-none dark:border-none transition-all"
                >
                    {/* Like */}
                    <div className="relative flex items-center justify-center gap-1.5 h-full">
                        <motion.button
                            whileTap={{ scale: 0.85 }}
                            className="flex items-center justify-center h-full select-none"
                            onClick={handleLike}
                        >
                            <Heart
                                className={cn(
                                    "w-5 h-5",
                                    post.user_reactions?.has_hearted ? "text-red-500 fill-red-500" : "text-muted-foreground"
                                )}
                                fill={post.user_reactions?.has_hearted ? "currentColor" : "none"}
                            />
                        </motion.button>
                        <span className="text-sm font-bold text-muted-foreground select-none ml-0.5">
                            {post.reactions?.hearts || 0}
                        </span>
                    </div>

                    {/* Comments */}
                    <motion.button
                        whileTap={{ scale: 0.85 }}
                        className="flex items-center justify-center gap-1.5 h-full select-none"
                        onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
                    >
                        <MessageCircle className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm font-bold text-muted-foreground select-none">{post.reactions?.comments || 0}</span>
                    </motion.button>

                    {/* Bookmark */}
                    <motion.button
                        whileTap={{ scale: 0.85 }}
                        className="flex items-center justify-center h-full"
                        onClick={handleBookmark}
                    >
                        <Bookmark
                            className={cn("w-5 h-5", post.user_reactions?.has_bookmarked ? "text-primary fill-primary" : "text-muted-foreground")}
                            fill={post.user_reactions?.has_bookmarked ? "currentColor" : "none"}
                        />
                    </motion.button>
                </div>
            </CardFooter>

            {/* Comments Drawer (reused, works as sheet) */}
            <CommentsDrawer
                post={post}
                isOpen={showComments}
                onClose={() => setShowComments(false)}
                mode="view"
            />
        </Card >
    );
};
