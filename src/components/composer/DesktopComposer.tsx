import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { MediaActionBar } from "./MediaActionBar";
import { MediaPreviewTray } from "@/components/media/MediaPreviewTray";
import { TiptapEditor, TiptapEditorRef } from "./TiptapEditor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { generateQA, fetchArticlePreview, classifyContent } from "@/lib/ai-helpers";
import { getWordCount } from "@/lib/gate-utils";
import { addBreadcrumb, clearPendingPublish } from "@/lib/crashBreadcrumbs";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/hooks/usePosts";

interface DesktopComposerProps {
    quotedPost?: Post | null;
    onClearQuote?: () => void;
    onPublishSuccess?: (postId: string) => void;
}

export const DesktopComposer = ({ quotedPost, onClearQuote, onPublishSuccess }: DesktopComposerProps) => {
    const { user } = useAuth();
    const { data: profile } = useCurrentProfile();
    const [content, setContent] = useState("");
    const [isPublishing, setIsPublishing] = useState(false);
    const editorRef = useRef<TiptapEditorRef>(null);

    const {
        uploadMedia,
        uploadedMedia,
        removeMedia,
        isUploading,
        clearMedia
    } = useMediaUpload();

    // Basic validation (simplified for desktop MVP)
    const canPublish = content.trim().length > 0 || uploadedMedia.length > 0 || !!quotedPost;

    // If quotedPost is present, scroll to composer
    useEffect(() => {
        if (quotedPost) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            editorRef.current?.focus?.();
        }
    }, [quotedPost]);

    const handlePublish = async () => {
        if (!canPublish || isPublishing) return;

        setIsPublishing(true);
        addBreadcrumb('desktop_publish_start');

        try {
            const { data, error } = await supabase.functions.invoke('publish-post', {
                body: {
                    content,
                    mediaIds: uploadedMedia.map(m => m.id),
                    quotedPostId: quotedPost?.id,
                    // Add other fields as necessary (metadata, etc.)
                }
            });

            if (error) throw error;

            toast.success("Post pubblicato con successo!");
            setContent("");
            // Reset editor by re-setting content
            editorRef.current?.focus?.();
            clearMedia();
            onClearQuote?.();

            if (data?.post_id) {
                onPublishSuccess?.(data.post_id);
            }

        } catch (error) {
            console.error("Publish error:", error);
            toast.error("Errore durante la pubblicazione. Riprova.");
        } finally {
            setIsPublishing(false);
        }
    };

    const getInitials = (name: string) => {
        return name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
    };

    return (
        <Card className="mb-8 p-4 border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
            <div className="flex gap-4">
                <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage src={profile?.avatar_url || ""} />
                    <AvatarFallback>{getInitials(profile?.full_name || "")}</AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-4">
                    <div className="min-h-[120px]">
                        <TiptapEditor
                            ref={editorRef}
                            initialContent=""
                            onChange={(markdown) => setContent(markdown)}
                            placeholder={quotedPost ? "Aggiungi un commento..." : "Cosa c'è di nuovo? Condividi i tuoi pensieri..."}
                            className="prose-lg"
                        />
                    </div>

                    {quotedPost && (
                        <div className="relative rounded-xl border border-border bg-muted/30 p-4 mb-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 h-6 w-6 rounded-full hover:bg-background/80"
                                onClick={onClearQuote}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                            <div className="flex gap-3">
                                <div className="w-1 h-full bg-primary/20 rounded-full" />
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Avatar className="h-5 w-5">
                                            <AvatarImage src={quotedPost.author.avatar_url || ""} />
                                            <AvatarFallback>U</AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm font-semibold">{quotedPost.author.full_name || quotedPost.author.username}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-3">
                                        {quotedPost.content || "Allegato multimediale"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {uploadedMedia.length > 0 && (
                        <MediaPreviewTray
                            media={uploadedMedia}
                            onRemove={removeMedia}
                        />
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <MediaActionBar
                            onFilesSelected={(files, type) => uploadMedia(files, type)}
                            disabled={isPublishing}
                        />

                        <Button
                            onClick={handlePublish}
                            disabled={!canPublish || isPublishing}
                            className="rounded-full px-6 font-semibold"
                        >
                            {isPublishing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Pubblicazione...
                                </>
                            ) : (
                                "Pubblica"
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
};
