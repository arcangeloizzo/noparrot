import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { MediaActionBar } from "./MediaActionBar";
import { MediaPreviewTray } from "@/components/media/MediaPreviewTray";
import { TiptapEditor, TiptapEditorRef } from "./TiptapEditor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { addBreadcrumb } from "@/lib/crashBreadcrumbs";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/hooks/usePosts";
import { PollCreator, PollData } from "./PollCreator";

interface DesktopComposerProps {
    quotedPost?: Post | null;
    onClearQuote?: () => void;
    onPublishSuccess?: (postId: string) => void;
}

export const DesktopComposer = ({ quotedPost, onClearQuote, onPublishSuccess }: DesktopComposerProps) => {
    const { user } = useAuth();
    const { data: profile } = useCurrentProfile();
    const [content, setContent] = useState("");
    const [postTitle, setPostTitle] = useState("");
    const [isPublishing, setIsPublishing] = useState(false);
    const [pollData, setPollData] = useState<PollData | null>(null);
    const editorRef = useRef<TiptapEditorRef>(null);

    const {
        uploadMedia,
        uploadedMedia,
        removeMedia,
        clearMedia
    } = useMediaUpload();

    const hasValidPoll = !!pollData && pollData.options.filter((o) => o.trim()).length >= 2;
    const canPublish =
        content.trim().length > 0 ||
        postTitle.trim().length > 0 ||
        uploadedMedia.length > 0 ||
        !!quotedPost ||
        hasValidPoll;

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
                    title: postTitle.trim() || undefined,
                    mediaIds: uploadedMedia.map((m) => m.id),
                    quotedPostId: quotedPost?.id,
                    pollData: hasValidPoll
                        ? {
                            options: pollData!.options.filter((o) => o.trim()),
                            durationPreset: pollData!.durationPreset,
                            allowMultiple: pollData!.allowMultiple,
                        }
                        : undefined,
                }
            });

            if (error) throw error;
            if ((data as any)?.error) throw new Error((data as any).error);

            toast.success("Post pubblicato con successo!");
            setContent("");
            setPostTitle("");
            clearMedia();
            setPollData(null);
            onClearQuote?.();
            editorRef.current?.focus?.();

            const createdPostId = (data as any)?.postId || (data as any)?.post_id;
            if (createdPostId) {
                onPublishSuccess?.(createdPostId);
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
                    <div className="space-y-3">
                        <Input
                            value={postTitle}
                            onChange={(e) => setPostTitle(e.target.value)}
                            placeholder="Dai un titolo (opzionale)"
                            maxLength={500}
                            disabled={isPublishing}
                            className="border-border/50 bg-background/60"
                        />

                        <div className="min-h-[120px]">
                            <TiptapEditor
                                ref={editorRef}
                                initialContent=""
                                onChange={(markdown) => setContent(markdown)}
                                placeholder={quotedPost ? "Aggiungi un commento..." : "Cosa c'è di nuovo? Condividi i tuoi pensieri..."}
                                className="prose-lg"
                            />
                        </div>
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

                    {pollData && (
                        <PollCreator
                            pollData={pollData}
                            onChange={setPollData}
                            onRemove={() => setPollData(null)}
                            disabled={isPublishing}
                        />
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
                            onCreatePoll={() => !pollData && setPollData({ options: ['', ''], durationPreset: '24h', allowMultiple: false })}
                            hasPoll={!!pollData}
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
