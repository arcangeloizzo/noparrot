import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { DiaryEntry, DiaryEntryData, DiaryEntryType } from "@/components/profile/DiaryEntry";
import { DiaryFilters, DiaryFilterType } from "@/components/profile/DiaryFilters";
import { ProfileSettingsSheet } from "@/components/profile/ProfileSettingsSheet";
import { ConnectionsSheet } from "@/components/profile/ConnectionsSheet";
import { CompactNebula } from "@/components/profile/CompactNebula";
import { NebulaExpandedSheet } from "@/components/profile/NebulaExpandedSheet";
import { AvatarWithRing } from "@/components/profile/AvatarWithRing";
import { PulseCard } from "@/components/profile/PulseCard";
import { getDisplayUsername } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useCognitiveDensity } from "@/hooks/useCognitiveDensity";
import { useUserComprehensionCount } from "@/hooks/useUserComprehensionCount";
import { useNebulaFilter } from "@/hooks/useNebulaFilter";
import { DiarioFilterChip } from "@/components/profile/DiarioFilterChip";
import { normalizeCategory } from "@/config/categories";
import { Settings, Bookmark } from "lucide-react";

export const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [diaryFilter, setDiaryFilter] = useState<DiaryFilterType>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [showNebulaExpanded, setShowNebulaExpanded] = useState(false);

  // Connections Sheet State
  const [showConnections, setShowConnections] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<"followers" | "following">("following");

  // Refs for scrolling
  const nebulaRef = useRef<HTMLDivElement>(null);
  const diaryRef = useRef<HTMLDivElement>(null);

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Nebulosa derivata (RPC) — sostituisce profiles.cognitive_density
  // isOwnProfile=true → usa wrapper fresh che fa refresh on-demand della MV
  const { data: cognitiveDensity } = useCognitiveDensity(user?.id);
  const { data: comprehensionCount = 0 } = useUserComprehensionCount(user?.id);

  // Phase 4.5 — filtro Nebulosa → Diario (persistente in sessionStorage per utente)
  const {
    selectedMacro,
    selectedTopic,
    setSelectedMacro,
    setSelectedTopic,
    clearFilter,
    clearTopicOnly,
  } = useNebulaFilter(user?.id);

  const handleMacroClick = (macro: string) => {
    setSelectedMacro(macro);
    setTimeout(() => {
      diaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    queryFn: async () => {
      if (!user) return { following: 0, followers: 0, posts: 0, activeTopics: 0 };

      const [followingRes, followersRes, postsRes] = await Promise.all([
        supabase.from("followers").select("id", { count: "exact" }).eq("follower_id", user.id),
        supabase.from("followers").select("id", { count: "exact" }).eq("following_id", user.id),
        supabase.from("posts").select("id", { count: "exact" }).eq("author_id", user.id),
      ]);

      return {
        following: followingRes.count || 0,
        followers: followersRes.count || 0,
        posts: postsRes.count || 0,
        activeTopics: 0, // calcolato sotto da cognitiveDensity derivata
      };
    },
    enabled: !!user && !!profile,
  });

  // Fetch diary entries (user posts + gated posts)
  const { data: diaryEntries = [], isLoading: loadingDiary } = useQuery({
    queryKey: ["diary-entries", user?.id, diaryFilter],
    queryFn: async () => {
      if (!user) return [];

      // 1. Fetch user's own posts
      const { data: userPosts, error: postsError } = await supabase
        .from("posts")
        .select(`
          id, content, shared_title, shared_url, quoted_post_id, 
          sources, preview_img, created_at, category,
          post_topics ( topic_id, topic_label )
        `)
        .eq("author_id", user.id)
        .eq("is_removed", false)
        .order("created_at", { ascending: false });

      if (postsError) {
        console.error("Error fetching user posts:", postsError);
        return [];
      }

      // 2. Fetch posts where user passed gate
      const { data: gatedPosts, error: gatedError } = await supabase
        .from("post_gate_attempts")
        .select(`
          post_id, created_at,
          posts!inner(id, content, shared_title, shared_url, quoted_post_id, 
            sources, preview_img, created_at, category, author_id,
            post_topics ( topic_id, topic_label ))
        `)
        .eq("user_id", user.id)
        .eq("passed", true)
        .eq("posts.is_removed", false)
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

      // Map gated posts (not authored by user)
      const gatedEntries: DiaryEntryData[] = (gatedPosts || [])
        .filter(g => g.posts.author_id !== user.id)
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
    enabled: !!user,
  });

  // Filter diary entries
  const filteredEntries = diaryEntries.filter(entry => {
    // Phase 4.5: filtro per macro-categoria (Nebulosa)
    if (selectedMacro) {
      const norm = normalizeCategory(entry.category);
      if (norm !== selectedMacro) return false;
    }
    // Phase 4.6c: filtro per topic_id specifico
    if (selectedTopic) {
      if (entry.topic_id !== selectedTopic.id) return false;
    }
    if (diaryFilter === 'all') return true;
    if (diaryFilter === 'original') return entry.type === 'original';
    if (diaryFilter === 'reshared') return entry.type === 'reshared';
    if (diaryFilter === 'gated') return entry.type === 'gated';
    return true;
  });

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

  const openConnections = () => {
    setConnectionsTab("following"); // On personal profile, usually interested in who I follow
    setShowConnections(true);
  };

  const openFollowers = () => {
    setConnectionsTab("followers");
    setShowConnections(true);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Errore nel caricamento del profilo</div>
      </div>
    );
  }

  if (!user) return null;

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen bg-background pb-24 urban-texture">
        <div className="max-w-[600px] mx-auto pt-10 pb-4">
          <div className="px-5 flex justify-end items-center gap-2 mb-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="w-10 h-10 rounded-full" />
          </div>
          <div className="flex flex-row items-start gap-4 px-5">
            <Skeleton className="rounded-full" style={{ width: 88, height: 88 }} />
            <div className="flex-1 min-w-0 pt-1 space-y-2">
              <Skeleton style={{ width: 160, height: 24 }} />
              <Skeleton style={{ width: 100, height: 16 }} />
            </div>
          </div>
          <div className="px-5 pt-6 space-y-3">
            <Skeleton style={{ width: 80, height: 44 }} />
            <Skeleton style={{ width: 280, height: 16 }} />
          </div>
        </div>
      </div>
    );
  }

  const totalPaths = comprehensionCount;
  const activeTopics = cognitiveDensity.rows.filter(r => r.density > 0).length;

  return (
    <div className="min-h-screen bg-background pb-24 urban-texture">
      <div className="max-w-[600px] mx-auto">
        {/* Header - Avatar, Name, Bio, Settings */}
        <div className="pt-10 pb-4">
          {/* Top-right action buttons */}
          <div className="px-5 flex justify-end items-center gap-2 mb-3">
            <button
              onClick={() => navigate('/saved')}
              className="flex-shrink-0 p-2.5 rounded-full bg-secondary border border-border hover:border-border/50 transition-colors"
              aria-label="Contenuti salvati"
            >
              <Bookmark className="w-5 h-5 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex-shrink-0 p-2.5 rounded-full bg-secondary border border-border hover:border-border/50 transition-colors"
              aria-label="Impostazioni"
            >
              <Settings className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Identity block: avatar + name/handle/bio */}
          <div
            className="flex flex-row items-start gap-4 px-5"
          >
            <AvatarWithRing
              src={profile?.avatar_url}
              alt={profile?.full_name || profile?.username || "Avatar"}
              fallback={getInitials(getDisplayUsername(profile?.username || "U"))}
              size={88}
            />

            <div className="flex-1 min-w-0 pt-1">
              <h1
                className="font-inter font-bold text-foreground truncate"
                style={{ fontSize: 22, letterSpacing: "-0.02em", lineHeight: 1.1 }}
              >
                {profile?.full_name?.trim() && !profile.full_name.includes('@') && profile.full_name.includes(' ')
                  ? profile.full_name
                  : getDisplayUsername(profile?.username || '')}
              </h1>
              <p
                className="text-muted-foreground"
                style={{ fontSize: 14, fontWeight: 400, marginTop: 2 }}
              >
                @{getDisplayUsername(profile?.username || '')}
              </p>

              {profile?.bio ? (
                <p
                  className={`text-foreground ${profile.is_ai_institutional ? '' : 'line-clamp-3'}`}
                  style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.45, marginTop: 10 }}
                >
                  {profile.bio}
                </p>
              ) : (
                <p
                  className="italic text-muted-foreground/60"
                  style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.45, marginTop: 10 }}
                >
                  In questo periodo sto cercando di capire meglio…
                </p>
              )}

              {profile?.is_ai_institutional && (
                <p className="text-xs mt-2" style={{ color: '#A78BFA' }}>
                  🤖 Questa è una Voce AI di NoParrot
                </p>
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
                onClick={openConnections}
                className="hover:text-foreground transition-colors"
              >
                <b className="text-foreground/80" style={{ fontWeight: 600 }}>{stats?.following || 0}</b> persone seguite
              </button>
              <span aria-hidden style={{ opacity: 0.4 }}>·</span>
              <button
                type="button"
                onClick={openFollowers}
                className="hover:text-foreground transition-colors"
              >
                <b className="text-foreground/80" style={{ fontWeight: 600 }}>{stats?.followers || 0}</b> ti seguono
              </button>
            </div>
          </div>
        </div>

        {/* Weekly Pulse */}
        <div className="px-5 mt-5">
          <PulseCard />
        </div>

        {/* Compact Cognitive Nebula (expandable) */}
        <div ref={nebulaRef} className="px-4 mt-6 mb-4 scroll-mt-20" data-tutorial="nebulosa">
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
              Tutto ciò che hai compreso, condiviso e creato.
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
                  color={undefined}
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
                  ? `Nessun post per il topic "${selectedTopic.label}".`
                  : selectedMacro
                  ? `Non hai ancora interazioni in ${selectedMacro}. Esplora i contenuti per espandere la tua mappa.`
                  : diaryFilter === 'all'
                  ? 'Nessun contenuto nel tuo diario. Inizia a creare o condividere!'
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

      {/* Settings Bottom Sheet */}
      <ProfileSettingsSheet
        open={showSettings}
        onOpenChange={setShowSettings}
      />

      {/* Connections Sheet */}
      {user?.id && (
        <ConnectionsSheet
          open={showConnections}
          onOpenChange={setShowConnections}
          userId={user.id}
          defaultTab={connectionsTab}
        />
      )}

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
      />

      <BottomNavigation
        activeTab="profile"
        onTabChange={(tab) => {
          if (tab === 'home') navigate('/');
          else if (tab === 'search') navigate('/search');
        }}
        onProfileClick={() => { }} // Already on profile
      />
    </div>
  );
};

export default Profile;
