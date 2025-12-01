import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { GateButton } from "@/components/ui/gate-button";
import { TrustBadge } from "@/components/ui/trust-badge";
import { fetchTrustScore } from "@/lib/comprehension-gate";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, X, ExternalLink, Image as ImageIcon, Video } from "lucide-react";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { MediaUploadButton } from "@/components/media/MediaUploadButton";
import { MediaPreviewTray } from "@/components/media/MediaPreviewTray";
import { normalizeUrl, uniqueSources } from "@/lib/url";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MentionDropdown } from "@/components/feed/MentionDropdown";
import { useUserSearch } from "@/hooks/useUserSearch";
import { useQueryClient } from "@tanstack/react-query";
import { updateCognitiveDensityWeighted } from "@/lib/cognitiveDensity";
import { classifyContent } from "@/lib/ai-helpers";

interface EnhancedComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: (post: any) => void;
  quotedPost?: any;
}

export function EnhancedComposer({ 
  isOpen, 
  onClose, 
  onPostCreated,
  quotedPost 
}: EnhancedComposerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [publishedPost, setPublishedPost] = useState<any>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [urlPreview, setUrlPreview] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { uploadMedia, uploadedMedia, removeMedia, clearMedia, isUploading } = useMediaUpload();
  const { data: mentionUsers = [], isLoading: isSearching } = useUserSearch(mentionQuery);

  const handleSelectMention = (user: any) => {
    const textBeforeCursor = text.slice(0, cursorPosition);
    const textAfterCursor = text.slice(cursorPosition);
    
    const beforeMention = textBeforeCursor.replace(/@\w*$/, '');
    const newText = `${beforeMention}@${user.username} ${textAfterCursor}`;
    const newCursorPos = beforeMention.length + user.username.length + 2;
    
    setText(newText);
    setShowMentions(false);
    setMentionQuery('');
    setSelectedMentionIndex(0);
    setCursorPosition(newCursorPos);
    
    // Force focus and cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Reset selection when users change
  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [mentionUsers]);

  const addSource = () => {
    const url = newSourceUrl.trim();
    if (!url) return;

    try {
      new URL(url);
      
      // Controllo duplicati con normalizzazione
      const normalized = normalizeUrl(url);
      const originalSources = quotedPost?.sources || [];
      const alreadyExists = [...originalSources, ...sources].some(
        s => normalizeUrl(s) === normalized
      );
      
      if (alreadyExists) {
        toast({
          title: "Fonte già inclusa",
          description: "Questa fonte è già presente nel post",
          variant: "destructive"
        });
        return;
      }
      
      setSources(prev => [...prev, url]);
      setNewSourceUrl("");
      toast({
        title: "Fonte aggiunta",
        description: "La fonte è stata aggiunta con successo",
      });
    } catch {
      toast({
        title: "URL non valido",
        description: "Inserisci un URL valido per la fonte",
        variant: "destructive"
      });
    }
  };

  const removeSource = (url: string) => {
    setSources(prev => prev.filter(s => s !== url));
  };

  const handleGatePassed = async (gateResult: any) => {
    try {
      setIsProcessing(true);

      if (!user) {
        toast({
          title: "Errore",
          description: "Devi essere autenticato",
          variant: "destructive"
        });
        return;
      }

      // NON fare merge delle fonti - il post principale ha solo le sue fonti
      // Il quoted post mantiene le sue fonti separatamente
      console.log('[Composer] Creating post with sources:', { newSources: sources, quotedPostId: quotedPost?.id });

      console.log('[Composer] ===== POST INSERT DEBUG =====');
      console.log('[Composer] Pre-insert data:', {
        sources,
        sourcesIsArray: Array.isArray(sources),
        sourcesLength: sources.length,
        firstSource: sources[0],
        sourcesJson: JSON.stringify(sources),
        userId: user.id
      });

      // Calculate Trust Score solo sulle fonti del nuovo post
      let trustScore = null;
      try {
        trustScore = await fetchTrustScore({
          postText: text,
          sources: sources,
          userMeta: { verified: false }
        });
        console.log('[Composer] Trust Score calculated:', {
          band: trustScore?.band,
          score: trustScore?.score
        });
      } catch (trustError) {
        console.error('[Composer] ❌ Trust Score error:', trustError);
      }

      const insertPayload = {
        content: text,
        author_id: user.id,
        sources: sources.length > 0 ? sources : null,
        shared_url: sources.length > 0 ? sources[0] : null,
        shared_title: urlPreview?.title || null,
        preview_img: urlPreview?.image || null,
        article_content: urlPreview?.content || null,
        embed_html: urlPreview?.embedHtml || null,
        transcript: urlPreview?.transcript || null,
        transcript_source: urlPreview?.transcriptSource || null,
        trust_level: trustScore?.band || null,
        quoted_post_id: quotedPost?.id || null
      };
      
      console.log('[Composer] Insert payload:', JSON.stringify(insertPayload, null, 2));

      // Create the post in DB with shared_url (first source)
      const { data: insertedPost, error: postError } = await supabase
        .from('posts')
        .insert(insertPayload)
        .select()
        .single();

      if (postError) {
        console.error('[Composer] ❌ Database insert error:', postError);
        throw postError;
      }

      console.log('[Composer] ✅ Post inserted successfully:', {
        id: insertedPost?.id,
        sources: insertedPost?.sources,
        sourcesType: typeof insertedPost?.sources,
        shared_url: insertedPost?.shared_url,
        trust_level: insertedPost?.trust_level
      });
      
      console.log('[Composer] ===== END DEBUG =====');

      console.log('[Composer] Post created:', { 
        success: !!insertedPost, 
        error: postError,
        postId: insertedPost?.id,
        savedSources: insertedPost?.sources,
        savedTrustLevel: insertedPost?.trust_level
      });

      if (postError) {
        console.error('[Composer] Error creating post:', postError);
        throw postError;
      }

      // Salvare post_media
      if (uploadedMedia.length > 0 && insertedPost) {
        for (let i = 0; i < uploadedMedia.length; i++) {
          await supabase.from('post_media').insert({
            post_id: insertedPost.id,
            media_id: uploadedMedia[i].id,
            order_idx: i
          });
        }
      }

      // Classifica il contenuto e aggiorna cognitive density
      const category = await classifyContent({
        text: text,
        title: urlPreview?.title,
        summary: urlPreview?.content || urlPreview?.summary
      });

      if (category) {
        const action = quotedPost?.id ? 'SHARE_POST' : 'CREATE_POST';
        await updateCognitiveDensityWeighted(user.id, category, action);
      }

      setPublishedPost({
        ...insertedPost,
        trustScore
      });
      
      onPostCreated?.(insertedPost);

      toast({
        title: "Condiviso."
      });

      // Invalida e refetch queries DOPO il toast per mostrare subito il post
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      await queryClient.refetchQueries({ queryKey: ['posts'] });

      // Reset form e chiudi
      setText("");
      setSources([]);
      clearMedia();
      setTimeout(() => onClose(), 800);
      
    } catch (error) {
      console.error("Error publishing post:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la pubblicazione",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-fade-in" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <Card className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden animate-scale-in glass-panel border-glass shadow-glass">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border/50">
            <h2 className="text-xl font-semibold text-foreground">
              Crea Post con Comprehension Gate
            </h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onClose}
              className="hover:bg-muted/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Reader Content for Gate Tracking */}
            <div 
              ref={readerRef} 
              className="p-6 border-b border-border/30 max-h-40 overflow-y-auto bg-muted/20"
            >
              <h3 className="font-semibold mb-2 text-foreground">
                Linee guida per la pubblicazione responsabile
              </h3>
              <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
                <p>Prima di pubblicare, leggi attentamente queste linee guida:</p>
                <p>• Assicurati che il contenuto sia accurato e verificabile</p>
                <p>• Includi fonti credibili quando possibile</p>
                <p>• Evita di diffondere informazioni non verificate</p>
                <p>• Rispetta il punto di vista degli altri utenti</p>
                <p>• Contribuisci a una discussione costruttiva</p>
                <p>Il nostro sistema valuterà automaticamente l'affidabilità del tuo post basandosi sulle fonti fornite e sulla qualità del contenuto.</p>
                <p>Ricorda: la responsabilità nella condivisione delle informazioni è fondamentale per mantenere un ambiente di discussione sano e produttivo.</p>
              </div>
            </div>

            {/* Composer Form */}
            <div className="p-6 space-y-6">
              {/* Post Text */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Scrivi il tuo post
                </label>
                
                {/* Wrapper con position relative */}
                <div className="relative">
                  <Textarea
                    ref={textareaRef}
                    value={text}
                    onChange={async (e) => {
                      const value = e.target.value;
                      const cursorPos = e.target.selectionStart;
                      
                      setText(value);
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
                      
                      // Auto-detect URL and load preview
                      const urlMatch = value.match(/https?:\/\/[^\s]+/);
                      if (urlMatch && !isLoadingPreview && !urlPreview) {
                        const detectedUrl = urlMatch[0];
                        setIsLoadingPreview(true);
                        
                        toast({
                          title: "Caricamento anteprima...",
                          description: "Attendere prego"
                        });
                        
                        try {
                          const { data, error } = await supabase.functions.invoke('fetch-article-preview', {
                            body: { url: detectedUrl }
                          });
                          
                          if (error) throw error;
                          
                          if (data) {
                            console.log('[EnhancedComposer] Preview loaded:', data);
                            setUrlPreview(data);
                            
                            // Remove URL from text
                            const newText = value.replace(detectedUrl, '').trim();
                            setText(newText);
                            
                            // Add to sources
                            if (!sources.includes(detectedUrl)) {
                              setSources(prev => [...prev, detectedUrl]);
                            }
                            
                            toast({
                              title: "✅ Anteprima caricata",
                              description: "URL rimosso dal testo e aggiunto alle fonti"
                            });
                            
                            // Restore focus
                            setTimeout(() => {
                              if (textareaRef.current) {
                                textareaRef.current.focus();
                                const pos = newText.length;
                                textareaRef.current.setSelectionRange(pos, pos);
                                setCursorPosition(pos);
                              }
                            }, 100);
                          }
                        } catch (error) {
                          console.error('Error loading preview:', error);
                          toast({
                            title: "Errore",
                            description: "Impossibile caricare l'anteprima",
                            variant: "destructive"
                          });
                        } finally {
                          setIsLoadingPreview(false);
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (!showMentions || mentionUsers.length === 0) return;
                      
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
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSelectMention(mentionUsers[selectedMentionIndex]);
                      } else if (e.key === 'Escape') {
                        setShowMentions(false);
                      }
                    }}
                    placeholder="Condividi i tuoi pensieri... Usa @ per menzionare"
                    className="min-h-[120px] resize-none focus:ring-primary/20"
                    rows={5}
                  />
                  
                  {showMentions && (
                    <MentionDropdown
                      users={mentionUsers}
                      selectedIndex={selectedMentionIndex}
                      onSelect={handleSelectMention}
                      isLoading={isSearching}
                      position="below"
                    />
                  )}
                </div>
              </div>
              
              {/* URL Preview Card */}
              {urlPreview && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      Anteprima Link
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUrlPreview(null);
                        setSources(prev => prev.filter(s => !sources.includes(s)));
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="border border-border rounded-xl overflow-hidden bg-muted/20">
                    {urlPreview.image && (
                      <div className="aspect-video w-full overflow-hidden bg-muted">
                        <img 
                          src={urlPreview.image}
                          alt={urlPreview.title || ''}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-3">
                      {urlPreview.platform === 'twitter' && urlPreview.author_username && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-semibold text-primary">
                              {urlPreview.author_username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-semibold">@{urlPreview.author_username}</span>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mb-1">{urlPreview.hostname}</div>
                      <div className="font-semibold text-sm mb-1">{urlPreview.title}</div>
                      {urlPreview.content && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{urlPreview.content}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Media Upload */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Aggiungi Media
                </label>
                <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/20">
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
                  {isUploading && (
                    <span className="text-xs text-muted-foreground ml-2">
                      Caricamento in corso...
                    </span>
                  )}
                </div>
                <MediaPreviewTray
                  media={uploadedMedia}
                  onRemove={removeMedia}
                />
              </div>

              {/* Sources Section */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Fonti (migliora il Trust Score)
                </label>
                
                {/* Add Source Input */}
                <div className="flex gap-2">
                  <Input
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    placeholder="Incolla l'URL di una fonte..."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSource();
                      }
                    }}
                  />
                  <Button 
                    onClick={addSource}
                    variant="outline"
                    className="hover-lift"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Sources List */}
                {sources.length > 0 && (
                  <div className="space-y-2">
                    {sources.map((source, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30"
                      >
                        <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 text-sm text-foreground truncate" title={source}>
                          {source}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSource(source)}
                          className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Gate Button */}
              <div className="pt-4 border-t border-border/30">
                <GateButton
                  content={{
                    id: "composer-guidelines",
                    title: "Linee guida per la pubblicazione responsabile",
                    text: "Contenuto delle linee guida di pubblicazione"
                  }}
                  onPassed={handleGatePassed}
                  containerRef={readerRef}
                  disabled={!text.trim() || isProcessing}
                  className="w-full"
                >
                  {isProcessing ? "Pubblicazione..." : "Pubblica Post"}
                </GateButton>
                
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Completa la lettura delle linee guida e supera il test per pubblicare
                </p>
              </div>
            </div>

            {/* Published Post Preview */}
            {publishedPost && (
              <div className="p-6 border-t border-border/30 bg-muted/10">
                <h3 className="font-semibold mb-3 text-foreground">
                  Post pubblicato
                </h3>
                <Card className="p-4 glass-panel border-glass">
                  <div className="space-y-3">
                    <p className="text-sm text-foreground">
                      {publishedPost.text}
                    </p>
                    
                    {publishedPost.sources.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Fonti:</p>
                        <div className="space-y-1">
                          {publishedPost.sources.map((source: string, i: number) => (
                            <div key={i} className="text-xs text-primary hover:underline">
                              <a href={source} target="_blank" rel="noopener noreferrer">
                                {source}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between pt-2">
                      <TrustBadge
                        band={publishedPost.trustScore?.band}
                        score={publishedPost.trustScore?.score}
                        reasons={publishedPost.trustScore?.reasons}
                        size="sm"
                      />
                      <div className="flex gap-2 text-lg">
                        <button className="hover:scale-110 transition-transform">❤️</button>
                        <button className="hover:scale-110 transition-transform">💬</button>
                        <button className="hover:scale-110 transition-transform">🔖</button>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export type { EnhancedComposerProps };