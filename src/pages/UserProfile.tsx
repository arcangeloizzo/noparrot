import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2 } from "lucide-react";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { CompactNebula } from "@/components/profile/CompactNebula";
import { NebulaExpandedSheet } from "@/components/profile/NebulaExpandedSheet";
import { ConnectionsSheet } from "@/components/profile/ConnectionsSheet";
import { DiaryEntry, DiaryEntryData, DiaryEntryType } from "@/components/profile/DiaryEntry";
import { DiaryFilters, DiaryFilterType } from "@/components/profile/DiaryFilters";
import { AvatarWithRing } from "@/components/profile/AvatarWithRing";
import { Skeleton } from "@/components/ui/skeleton";
import { getDisplayUsername } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCognitiveDensity } from "@/hooks/useCognitiveDensity";
import { useUserComprehensionCount } from "@/hooks/useUserComprehensionCount";
import { useNebulaFilter } from "@/hooks/useNebulaFilter";
import { DiarioFilterChip } from "@/components/profile/DiarioFilterChip";
import { normalizeCategory } from "@/config/categories";
import { buildShareUrl } from "@/config/share";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const UserProfile = () => {
  const { userId: paramValue } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Accept both UUIDs and usernames as :userId. Resolve username → id once.
  const isUuidParam = !!paramValue && UUID_RE.test(paramValue);
  const { data: resolvedId, isLoading: resolvingId } = useQuery({
    queryKey: ["profile-id-lookup", paramValue],
    queryFn: async () => {
      if (!paramValue) return null;
      if (isUuidParam) return paramValue;
      // Use the SECURITY DEFINER RPC — deterministic and grant-independent.
      const { data, error } = await (supabase as any).rpc(
        "resolve_profile_handle",
        { p_handle: paramValue }
      );
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    enabled: !!paramValue,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const userId = (resolvedId ?? undefined) as string | undefined;

  const [showNebulaExpanded, setShowNebulaExpanded] = useState(false);
  const [diaryFilter, setDiaryFilter] = useState<DiaryFilterType>('all');

  // Connections Sheet State
  const [showConnections, setShowConnections] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<"followers" | "following">("followers");

  // Refs for scrolling
  const nebulaRef = useRef<HTMLDivElement>(null);
  const diaryRef = useRef<HTMLDivElement>(null);

  // Use public_profiles view for other users to avoid exposing sensitive data
  // (date_of_birth, cognitive_tracking_enabled, cognitive_density are not exposed)
  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_profiles")
        .select("id, username, full_name, avatar_url, bio, created_at, is_ai_institutional")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Nebulosa derivata via RPC (rispetta cognitive_tracking_enabled lato server)
  const { data: cognitiveDensityData } = useCognitiveDensity(userId);
  const { data: comprehensionCount = 0 } = useUserComprehensionCount(userId);

  // Phase 4.5 — filtro Nebulosa → Diario (per-utente target)
  const {
    selectedMacro,
    selectedTopic,
    setSelectedMacro,
    setSelectedTopic,
    clearFilter,
    clearTopicOnly,
  } = useNebulaFilter(userId);

  const handleMacroClick = (macro: string) => {
    setSelectedMacro(macro);
    setTimeout(() => {
      diaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const { data: stats } = useQuery({
    queryKey: ["user-stats", userId],
    queryFn: async () => {
      if (!userId) return { following: 0, followers: 0, posts: 0, activeTopics: 0 };

      const [followingRes, followersRes, postsRes] = await Promise.all([
        supabase.from("followers").select("id", { count: "exact" }).eq("follower_id", userId),
        supabase.from("followers").select("id", { count: "exact" }).eq("following_id", userId),
        supabase.from("posts").select("id", { count: "exact" }).eq("author_id", userId),
      ]);

      return {
        following: followingRes.count || 0,
        followers: followersRes.count || 0,
        posts: postsRes.count || 0,
        activeTopics: 0, // calcolato sotto da cognitiveDensity derivata
      };
    },
    enabled: !!userId && !!profile,
  });

  const { data: isFollowing } = useQuery({
    queryKey: ["is-following", currentUser?.id, userId],
    queryFn: async () => {
      if (!currentUser || !userId) return false;
      const { data } = await supabase
        .from("followers")
        .select("id")
        .eq("follower_id", currentUser.id)
        .eq("following_id", userId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!currentUser && !!userId && userId !== currentUser?.id,
  });

  // Fetch diary entries for this user
  const { data: diaryEntries = [], isLoading: loadingDiary } = useQuery({
    queryKey: ["user-diary-entries", userId, diaryFilter],
    queryFn: async () => {
      if (!userId) return [];

      // Fetch user's own posts
      const { data: userPosts, error: postsError } = await supabase
        .from("posts")
        .select(`
          id, content, shared_title, shared_url, quoted_post_id, 
          sources, preview_img, created_at, category,
          post_topics ( topic_id, topic_label )
        `)
        .eq("author_id", userId)
        .order("created_at", { ascending: false });

      if (postsError) {
        console.error("Error fetching user posts:", postsError);
        return [];
      }

      // Fetch posts where user passed gate
      const { data: gatedPosts, error: gatedError } = await supabase
        .from("post_gate_attempts")
        .select(`
          post_id, created_at,
          posts!inner(id, content, shared_title, shared_url, quoted_post_id, 
            sources, preview_img, created_at, category, author_id,
            post_topics ( topic_id, topic_label ))
        `)
        .eq("user_id", userId)
        .eq("passed", true)
        .order("created_at", { ascending: false });

      if (gatedError) {
        console.error("Error fetching gated posts:", gatedError);
      }

      // Map user posts to diary entries
      const userEntries: DiaryEntryData[] = (userPosts || []).map(post => {
        let type: DiaryEntryType = 'original';
        if (post.quoted_post_id) type = 'reshared';
        else if (post.shared_url || (post.sources && Array.isArray(post.sources) && post.sources.length > 0)) type = 'gated';

        const pt = Array.isArray((post as any).post_topics)
          ? (post as any).post_topics[0]
          : (post as any).post_topics;
        return {
          id: post.id,
          content: post.content,
          shared_title: post.shared_title,
          shared_url: post.shared_url,
          quoted_post_id: post.quoted_post_id,
          sources: post.sources,
          preview_img: post.preview_img,
          created_at: post.created_at,
          category: post.category,
          type,
          topic_id: pt?.topic_id ?? null,
          topic_label: pt?.topic_label ?? null,
        };
      });

      // Map gated posts (not authored by this user)
      const gatedEntries: DiaryEntryData[] = (gatedPosts || [])
        .filter(g => g.posts.author_id !== userId)
        .map(g => {
          const pt = Array.isArray((g.posts as any).post_topics)
            ? (g.posts as any).post_topics[0]
            : (g.posts as any).post_topics;
          return {
          id: g.posts.id,
          content: g.posts.content,
          shared_title: g.posts.shared_title,
          shared_url: g.posts.shared_url,
          quoted_post_id: g.posts.quoted_post_id,
          sources: g.posts.sources,
          preview_img: g.posts.preview_img,
          created_at: g.created_at,
          category: g.posts.category,
          type: 'gated' as DiaryEntryType,
          passed_gate: true,
          topic_id: pt?.topic_id ?? null,
          topic_label: pt?.topic_label ?? null,
          };
        });

      // Merge and deduplicate
      const allEntries = [...userEntries, ...gatedEntries];
      const uniqueEntries = allEntries.filter((entry, index, self) =>
        index === self.findIndex(e => e.id === entry.id)
      );

      // Sort by date
      uniqueEntries.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      return uniqueEntries;
    },
    enabled: !!userId,
  });

  // Filter diary entries
  const filteredEntries = diaryEntries.filter(entry => {
    if (selectedMacro) {
      const norm = normalizeCategory(entry.category);
      if (norm !== selectedMacro) return false;
    }
    if (selectedTopic) {
      if (entry.topic_id !== selectedTopic.id) return false;
    }
    if (diaryFilter === 'all') return true;
    if (diaryFilter === 'original') return entry.type === 'original';
    if (diaryFilter === 'reshared') return entry.type === 'reshared';
    if (diaryFilter === 'gated') return entry.type === 'gated';
    return true;
  });

  const toggleFollowMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser || !userId) throw new Error("Not authenticated");

      if (isFollowing) {
        await supabase
          .from("followers")
          .delete()
          .eq("follower_id", currentUser.id)
          .eq("following_id", userId);
      } else {
        await supabase
          .from("followers")
          .insert({
            follower_id: currentUser.id,
            following_id: userId,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-following"] });
      queryClient.invalidateQueries({ queryKey: ["user-stats", userId] });
      toast({
        title: isFollowing ? "Non segui più questo utente" : "Ora segui questo utente",
      });
    },
  });

  // Recalculate cognitive density if empty - now handled by cognitiveDensityData query
  // No need for separate useEffect since we have dedicated query

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const openFollowers = () => {
    setConnectionsTab("followers"); // On public profile, show who follows them
    setShowConnections(true);
  };

  const openFollowing = () => {
    setConnectionsTab("following");
    setShowConnections(true);
  };

  if (!paramValue) {
    navigate('/');
    return null;
  }

  if (resolvingId && !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Caricamento profilo...</div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="text-foreground font-semibold">Profilo non trovato</div>
        <Button variant="outline" size="sm" onClick={() => navigate('/')}>Torna alla home</Button>
      </div>
    );
  }

  if (userId === currentUser?.id) {
    navigate('/profile');
    return null;
  }

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Caricamento profilo...</div>
      </div>
    );
  }

  const cognitiveDensity = cognitiveDensityData;
  const totalPaths = comprehensionCount;
  const activeTopics = cognitiveDensity.rows.filter(r => r.density > 0).length;

  const displayName = profile?.full_name?.trim() && !profile.full_name.includes('@') && profile.full_name.includes(' ')
    ? profile.full_name
    : getDisplayUsername(profile?.username || '');

  return (
    <div className="min-h-screen bg-background pb-24 urban-texture">
      <div className="max-w-[600px] mx-auto">
        {/* Header - Back Button, Avatar, Name, Bio, Follow Button */}
        <div className="px-5 pt-6 pb-4">
          {/* Back Button + Share */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="-ml-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                const handle = (profile?.username || '').trim();
                const shareIdentifier = handle || userId;
                const shareUrl = buildShareUrl('profile', shareIdentifier);
                const shareData = {
                  title: `Scopri i contributi di ${displayName} su NoParrot`,
                  text: profile?.bio?.substring(0, 100) || `Segui ${displayName} su NoParrot`,
                  url: shareUrl,
                };
                if (navigator.share && navigator.canShare?.(shareData)) {
                  try { await navigator.share(shareData); } catch (err: any) {
                    if (err instanceof Error && err.name !== 'AbortError') {
                      await navigator.clipboard.writeText(shareUrl);
                      toast({ title: 'Link copiato!' });
                    }
                  }
                } else {
                  await navigator.clipboard.writeText(shareUrl);
                  toast({ title: 'Link copiato!' });
                }
              }}
              className="-mr-2"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>

          {/* Identity block: avatar + name/handle/bio */}
          <div
            className="flex flex-row items-start gap-4"
          >
            <AvatarWithRing
              src={profile?.avatar_url}
              alt={displayName}
              fallback={getInitials(displayName)}
              size={88}
            />

            <div className="flex-1 min-w-0 pt-1">
              <h1
                className="font-inter font-bold text-foreground truncate"
                style={{ fontSize: 22, letterSpacing: "-0.02em", lineHeight: 1.1 }}
              >
                {displayName}
              </h1>
              <p
                className="text-muted-foreground"
                style={{ fontSize: 14, fontWeight: 400, marginTop: 2 }}
              >
                @{getDisplayUsername(profile?.username || '')}
              </p>

              {profile?.bio && (
                <p
                  className={`text-foreground ${profile.is_ai_institutional ? '' : 'line-clamp-3'}`}
                  style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.45, marginTop: 10 }}
                >
                  {profile.bio}
                </p>
              )}

              {profile?.is_ai_institutional && (
                <p className="text-xs mt-2" style={{ color: '#A78BFA' }}>
                  🤖 Questa è una Voce AI di NoParrot
                </p>
              )}

              {currentUser && (
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  size="sm"
                  className="mt-3 rounded-full"
                  onClick={() => toggleFollowMutation.mutate()}
                  disabled={toggleFollowMutation.isPending}
                >
                  {isFollowing ? "Non seguire più" : "Segui"}
                </Button>
              )}
            </div>
          </div>

          {/* Metrics block — hierarchical */}
          <div className="px-5 pt-5">
            {/* Hero row: total comprehensions */}
            <button
              type="button"
              onClick={() => scrollToSection(diaryRef)}
              className="flex items-baseline gap-2.5 text-left"
            >
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 44,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  background: "linear-gradient(135deg, #FFFFFF 0%, #A78BFA 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                }}
              >
                {Math.round(totalPaths)}
              </span>
              <span
                className="text-muted-foreground"
                style={{ fontSize: 14, fontWeight: 500 }}
              >
                cose{" "}
                <strong className="text-foreground" style={{ fontWeight: 600 }}>
                  comprese
                </strong>
              </span>
            </button>

            {/* Secondary row */}
            <div
              className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-muted-foreground"
              style={{ fontSize: 13 }}
            >
              <button
                type="button"
                onClick={() => scrollToSection(nebulaRef)}
                className="hover:text-foreground transition-colors"
              >
                <b className="text-foreground/80" style={{ fontWeight: 600 }}>{activeTopics}</b> territori esplorati
              </button>
              <span aria-hidden style={{ opacity: 0.4 }}>·</span>
              <button
                type="button"
                onClick={openFollowers}
                className="hover:text-foreground transition-colors"
              >
                <b className="text-foreground/80" style={{ fontWeight: 600 }}>{stats?.followers || 0}</b> follower
              </button>
              <span aria-hidden style={{ opacity: 0.4 }}>·</span>
              <button
                type="button"
                onClick={openFollowing}
                className="hover:text-foreground transition-colors"
              >
                <b className="text-foreground/80" style={{ fontWeight: 600 }}>{stats?.following || 0}</b> seguiti
              </button>
            </div>
          </div>
        </div>

        {/* Compact Cognitive Nebula (expandable) */}
        <div ref={nebulaRef} className="px-4 mb-4 scroll-mt-20">
          <CompactNebula
            data={cognitiveDensity}
            onExpand={() => setShowNebulaExpanded(true)}
            selectedMacro={selectedMacro}
            onMacroClick={handleMacroClick}
          />
        </div>

        {/* Cognitive Diary */}
        <div ref={diaryRef} className="px-4 pb-6 scroll-mt-20" data-section="diario">
          <div className="mb-3">
            <h3 className="text-base font-semibold">Diario Cognitivo</h3>
            <p className="text-xs text-muted-foreground">
              I percorsi di comprensione di {displayName}.
            </p>
          </div>

          {/* Phase 4.5 / 4.6c — chip filtri (macro + topic) */}
          {(selectedMacro || selectedTopic) && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground shrink-0">
                Filtri:
              </span>
              {selectedMacro && (
                <DiarioFilterChip
                  variant="macro"
                  macro={selectedMacro}
                  count={filteredEntries.length}
                  onClear={clearFilter}
                />
              )}
              {selectedTopic && (
                <DiarioFilterChip
                  variant="topic"
                  label={selectedTopic.label}
                  macro={selectedTopic.macro}
                  count={filteredEntries.length}
                  onClear={clearTopicOnly}
                />
              )}
            </div>
          )}

          {/* Filters */}
          <div className="mb-3">
            <DiaryFilters activeFilter={diaryFilter} onFilterChange={setDiaryFilter} />
          </div>

          {/* Diary Entries */}
          {loadingDiary ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredEntries.length > 0 ? (
            <div className="space-y-2">
              {filteredEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <DiaryEntry entry={entry} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">
                {selectedTopic
                  ? `Nessun post di ${displayName} per il topic "${selectedTopic.label}".`
                  : selectedMacro
                  ? `Nessuna interazione di ${displayName} in ${selectedMacro}.`
                  : diaryFilter === 'all'
                  ? 'Nessun contenuto nel diario.'
                  : 'Nessun contenuto per questo filtro.'}
              </p>
              {selectedTopic && (
                <button
                  type="button"
                  onClick={clearTopicOnly}
                  className="mt-2 text-sm text-primary hover:underline"
                >
                  Rimuovi filtro topic
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Nebula Expanded Sheet */}
      <NebulaExpandedSheet
        open={showNebulaExpanded}
        onOpenChange={setShowNebulaExpanded}
        cognitiveDensity={cognitiveDensity}
        selectedMacro={selectedMacro}
        onMacroClick={(macro) => {
          setSelectedMacro(macro);
        }}
        onTopicSelect={(topic) => {
          setSelectedTopic(topic);
        }}
        userId={userId}
      />

      {/* Connections Sheet */}
      {userId && (
        <ConnectionsSheet
          open={showConnections}
          onOpenChange={setShowConnections}
          userId={userId}
          defaultTab={connectionsTab}
        />
      )}

      <BottomNavigation
        activeTab=""
        onTabChange={(tab) => {
          if (tab === 'home') navigate('/');
          else if (tab === 'search') navigate('/search');
          else if (tab === 'saved') navigate('/saved');
          else if (tab === 'notifications') navigate('/notifications');
        }}
        onProfileClick={() => navigate('/profile')}
      />
    </div>
  );
};

export default UserProfile;
