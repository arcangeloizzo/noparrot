import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
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
import { useNebulaFilter } from "@/hooks/useNebulaFilter";
import { DiarioFilterChip } from "@/components/profile/DiarioFilterChip";
import { normalizeCategory, CATEGORY_COLORS } from "@/config/categories";
import { Settings, Bookmark, Share2 } from "lucide-react";
import { generateNebulaShareImage } from "@/lib/nebulaShareImage";
import { useToast } from "@/hooks/use-toast";

export const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [diaryFilter, setDiaryFilter] = useState<DiaryFilterType>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [showNebulaExpanded, setShowNebulaExpanded] = useState(false);
  const { toast } = useToast();

  // Connections Sheet State
  const [showConnections, setShowConnections] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<"followers" | "following">("following");

  // Refs for scrolling
  const nebulaRef = useRef<HTMLDivElement>(null);
  const diaryRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

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
  const { data: cognitiveDensity } = useCognitiveDensity(user?.id);

  const { data: summary } = useQuery({
    queryKey: ['profile-summary', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any)
        .rpc('get_profile_summary', { target_user_id: user.id })
        .single();
      if (error) throw error;
      return data as {
        comprehension_count: number;
        posts_count: number;
        followers_count: number;
        following_count: number;
        territories_count: number;
      };
    },
    enabled: !!user,
  });

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


  const PAGE_SIZE = 20;

  // Fetch diary entries (user posts + gated posts) via useInfiniteQuery
  const {
    data: diaryPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loadingDiary,
  } = useInfiniteQuery({
    queryKey: ["diary-entries", user?.id, diaryFilter, selectedMacro, selectedTopic?.id],
    queryFn: async ({ pageParam }) => {
      if (!user?.id) return [];

      const { data, error } = await (supabase as any).rpc("get_diary_entries", {
        p_user_id: user.id,
        p_limit: PAGE_SIZE,
        p_cursor: pageParam,
        p_diary_filter: diaryFilter,
        p_selected_macro: selectedMacro,
        p_selected_topic: selectedTopic?.id,
      });

      if (error) {
        console.error("Error fetching diary entries:", error);
        throw error;
      }

      return (data || []).map((entry: any) => {
        let type: DiaryEntryType = 'original';
        if (entry.quoted_post_id) type = 'reshared';
        else if (entry.shared_url || (entry.sources && Array.isArray(entry.sources) && entry.sources.length > 0)) type = 'gated';
        if (entry.passed_gate) type = 'gated';

        return {
          id: entry.id,
          content: entry.content,
          shared_title: entry.shared_title,
          shared_url: entry.shared_url,
          quoted_post_id: entry.quoted_post_id,
          sources: entry.sources,
          preview_img: entry.preview_img,
          created_at: entry.created_at,
          category: entry.category,
          type,
          passed_gate: entry.passed_gate,
          topic_id: entry.topic_id,
          topic_label: entry.topic_label,
          topic_ids: entry.topic_id ? [entry.topic_id] : [],
          voice_title: entry.voice_title,
          voice_body: entry.voice_body,
          challenge_title: entry.challenge_title,
          challenge_body: entry.challenge_body,
          media_url: entry.media_url,
          media_type: entry.media_type,
        } as DiaryEntryData;
      });
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1]?.created_at;
    },
    initialPageParam: null as string | null,
    enabled: !!user,
  });

  const allEntries = useMemo(() => {
    return diaryPages?.pages.flat() ?? [];
  }, [diaryPages]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Filter diary entries — completely handled in DB RPC, returned directly
  const filteredEntries = useMemo(() => {
    return allEntries;
  }, [allEntries]);

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

  useEffect(() => {
    if (!user) navigate('/auth');
  }, [user, navigate]);

  const handleExploreTap = (dominantCategory?: string) => {
    if (dominantCategory) {
      setSelectedMacro(dominantCategory);
    }
    // Piccolo delay per dare tempo al filtro di applicarsi prima dello scroll
    setTimeout(() => {
      document.getElementById('diario-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
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

  const totalPaths = summary?.comprehension_count ?? 0;
  const activeTopics = summary?.territories_count ?? 0;

  // Dominant territory color for hero gradient endpoint
  const dominantColor = (() => {
    const flat = (cognitiveDensity as any)?.byMacroFlat as Record<string, number> | undefined;
    if (!flat) return "#A78BFA";
    let best: string | null = null;
    let bestVal = -1;
    for (const [k, v] of Object.entries(flat)) {
      const key = normalizeCategory(k) ?? k;
      if ((v ?? 0) > bestVal) { bestVal = v ?? 0; best = key; }
    }
    return (best && CATEGORY_COLORS[best]) || "#A78BFA";
  })();
  const displayHandle = getDisplayUsername(profile?.username || '');

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
              onClick={async () => {
                try {
                  const blob = await generateNebulaShareImage({
                    displayName: profile?.full_name || profile?.username || 'NoParrot',
                    handle: profile?.username || null,
                    comprehensionCount: summary?.comprehension_count ?? 0,
                    byMacro: cognitiveDensity?.byMacroFlat ?? {},
                    dominantColor,
                  });
                  const file = new File([blob], 'nebulosa.png', { type: 'image/png' });
                  const shareUrl = `${window.location.origin}/profile/${user?.id ?? ''}`;
                  const nav: any = navigator;
                  if (nav.canShare?.({ files: [file] })) {
                    await nav.share({
                      files: [file],
                      title: 'La mia Nebulosa Cognitiva',
                      text: 'Scopri la mia mappa di comprensione su NoParrot',
                      url: shareUrl,
                    });
                  } else {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'nebulosa.png';
                    a.click();
                    URL.revokeObjectURL(a.href);
                    toast({ title: 'Immagine scaricata' });
                  }
                } catch (e) {
                  console.error(e);
                  toast({ title: 'Condivisione non riuscita' });
                }
              }}
              className="flex-shrink-0 p-2.5 rounded-full bg-secondary border border-border hover:border-border/50 transition-colors"
              aria-label="Condividi la nebulosa"
            >
              <Share2 className="w-5 h-5 text-muted-foreground" />
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
              size={74}
            />

            <div className="flex-1 min-w-0 pt-1">
              <h1
                className="truncate"
                style={{
                  fontFamily: "var(--display)",
                  fontSize: 27,
                  fontWeight: 400,
                  letterSpacing: "0.005em",
                  lineHeight: 1.05,
                  textTransform: "uppercase",
                  color: "var(--txt)",
                }}
              >
                {profile?.full_name?.trim() && !profile.full_name.includes('@') && profile.full_name.includes(' ')
                  ? profile.full_name
                  : getDisplayUsername(profile?.username || '')}
              </h1>
              {displayHandle && (
                <p
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--txt-3)",
                    textTransform: "lowercase",
                    letterSpacing: "0.02em",
                    marginTop: 4,
                  }}
                >
                  @{displayHandle}
                </p>
              )}

              {profile?.bio ? (
                <p
                  className={`text-foreground ${profile.is_ai_institutional ? '' : 'line-clamp-3'}`}
                  style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.45, marginTop: 10 }}
                >
                  {profile.bio}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/profile/edit')}
                  className="italic text-left hover:opacity-100 transition-opacity"
                  style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.45, marginTop: 10, color: 'hsl(var(--muted-foreground))', opacity: 0.6, fontStyle: 'italic' }}
                >
                  Aggiungi una bio
                </button>
              )}

              {profile?.is_ai_institutional && (
                <p className="text-xs mt-2" style={{ color: '#A78BFA' }}>
                  🤖 Questa è una Voce AI di NoParrot
                </p>
              )}
            </div>
          </div>

          {/* Metrics block — hero counter */}
          <div className="px-5 pt-6">
            <button
              type="button"
              onClick={() => scrollToSection(diaryRef)}
              className="text-left w-full flex items-end gap-3"
            >
              <span
                style={{
                  fontFamily: "var(--display)",
                  fontSize: 62,
                  fontWeight: 400,
                  letterSpacing: "-0.01em",
                  lineHeight: 0.92,
                  textTransform: "uppercase",
                  background: `linear-gradient(135deg, #FFFFFF 0%, ${dominantColor} 100%)`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                  display: "inline-block",
                }}
              >
                {Math.round(totalPaths)}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  lineHeight: 1.15,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  paddingBottom: 6,
                  display: "inline-flex",
                  flexDirection: "column",
                }}
              >
                <span style={{ color: "var(--txt-3)", fontWeight: 500 }}>cose</span>
                <span style={{ color: "var(--txt)", fontWeight: 700 }}>COMPRESE</span>
              </span>
            </button>

            {/* Secondary row — 3 celle con hairline */}
            <div
              className="mt-4 grid grid-cols-3"
              style={{
                borderTop: "1px solid rgba(255,255,255,0.08)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {[
                { label: "TERRITORI", value: activeTopics, onClick: () => scrollToSection(nebulaRef) },
                { label: "SEGUI", value: summary?.following_count || 0, onClick: openConnections },
                { label: "TI SEGUONO", value: summary?.followers_count || 0, onClick: openFollowers },
              ].map((cell, i) => (
                <button
                  key={cell.label}
                  type="button"
                  onClick={cell.onClick}
                  className="flex flex-col items-center justify-center py-2.5 hover:bg-white/[0.02] transition-colors"
                  style={{
                    borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.08)" : undefined,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--body, Inter), Inter, sans-serif",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "var(--txt)",
                      lineHeight: 1.1,
                    }}
                  >
                    {cell.value}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--txt-4)",
                      marginTop: 3,
                    }}
                  >
                    {cell.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly Pulse */}
        <div className="px-5 mt-5">
          <PulseCard onExploreTap={handleExploreTap} />
        </div>

        {/* Compact Cognitive Nebula (expandable) */}
        <div id="nebulosa-section" ref={nebulaRef} className="px-4 mt-6 mb-4 scroll-mt-20" data-tutorial="nebulosa">
          <CompactNebula
            data={cognitiveDensity}
            onExpand={() => setShowNebulaExpanded(true)}
            selectedMacro={selectedMacro}
            onMacroClick={handleMacroClick}
          />
        </div>

        {/* Cognitive Diary */}
        <div id="diario-section" ref={diaryRef} className="px-4 pb-6 scroll-mt-20" data-section="diario">
          <div className="mb-3">
            <h3
              style={{
                fontFamily: "var(--display)",
                fontSize: 19,
                fontWeight: 400,
                letterSpacing: "0.005em",
                textTransform: "uppercase",
                color: "var(--txt)",
                lineHeight: 1.05,
              }}
            >
              Diario Cognitivo
            </h3>
            <p
              style={{
                fontFamily: "var(--body, Inter), Inter, sans-serif",
                fontSize: 12.5,
                color: "var(--txt-4)",
                marginTop: 4,
              }}
            >
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
                  style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                >
                  <DiaryEntry entry={entry} />
                </div>
              ))}
              <div ref={loadMoreRef} className="h-10" />
              {isFetchingNextPage && <Skeleton className="h-16 w-full rounded-xl" />}
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
