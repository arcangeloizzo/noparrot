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
import { getDisplayUsername } from "@/lib/utils";
import { recalculateCognitiveDensityFromPosts } from "@/lib/cognitiveDensity";
import { Skeleton } from "@/components/ui/skeleton";
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

  // Recalculate cognitive density if empty
  useEffect(() => {
    const recalculateIfNeeded = async () => {
      if (profile && user?.id) {
        const density = profile.cognitive_density as Record<string, number> | null;
        const isEmpty = !density || Object.keys(density).length === 0;

        if (isEmpty) {
          const result = await recalculateCognitiveDensityFromPosts(user.id);
          if (result && Object.keys(result).length > 0) {
            queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
          }
        }
      }
    };
    recalculateIfNeeded();
  }, [profile?.id, user?.id, queryClient]);

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    queryFn: async () => {
      if (!user) return { following: 0, followers: 0, posts: 0, activeTopics: 0 };

      const [followingRes, followersRes, postsRes] = await Promise.all([
        supabase.from("followers").select("id", { count: "exact" }).eq("follower_id", user.id),
        supabase.from("followers").select("id", { count: "exact" }).eq("following_id", user.id),
        supabase.from("posts").select("id", { count: "exact" }).eq("author_id", user.id),
      ]);

      console.log('Stats Debug:', { following: followingRes.count, followers: followersRes.count, posts: postsRes.count, error: followingRes.error || followersRes.error || postsRes.error });

      const cognitiveDensity = (profile?.cognitive_density as Record<string, number>) || {};
      const activeTopics = Object.values(cognitiveDensity).filter(val => val > 0).length;

      return {
        following: followingRes.count || 0,
        followers: followersRes.count || 0,
        posts: postsRes.count || 0,
        activeTopics,
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
          sources, preview_img, created_at, category
        `)
        .eq("author_id", user.id)
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
            sources, preview_img, created_at, category, author_id)
        `)
        .eq("user_id", user.id)
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
        };
      });

      // Map gated posts (not authored by user)
      const gatedEntries: DiaryEntryData[] = (gatedPosts || [])
        .filter(g => g.posts.author_id !== user.id)
        .map(g => ({
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
        }));

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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Errore nel caricamento del profilo</div>
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Caricamento profilo...</div>
      </div>
    );
  }

  const cognitiveDensity = (profile?.cognitive_density as Record<string, number>) || {};
  const totalPaths = Object.values(cognitiveDensity).reduce((sum, val) => sum + val, 0);
  const activeTopics = Object.values(cognitiveDensity).filter(val => val > 0).length;

  return (
    <div className="min-h-screen bg-background pb-24 urban-texture">
      <div className="max-w-[600px] mx-auto">
        {/* Header - Avatar, Name, Bio, Settings */}
        <div className="px-6 pt-10 pb-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover shadow-[0_0_20px_rgba(10,122,255,0.15)] ring-2 ring-border"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-2xl font-semibold text-primary-foreground shadow-[0_0_20px_rgba(10,122,255,0.15)] ring-2 ring-border">
                  {getInitials(getDisplayUsername(profile?.username || "U"))}
                </div>
              )}
            </div>

            {/* Name & Bio */}
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-xl font-bold truncate">
                {profile?.full_name?.trim() && !profile.full_name.includes('@') && profile.full_name.includes(' ')
                  ? profile.full_name
                  : getDisplayUsername(profile?.username || '')}
              </h1>
              {profile?.bio && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                  {profile.bio}
                </p>
              )}
            </div>

            {/* Saved Icon + Settings Icon */}
            <div className="flex items-center gap-2">
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
          </div>

          {/* Metrics - New Hierarchy */}
          <div className="flex justify-around items-center mt-6 w-full px-2">

            {/* Cose comprese -> Scroll to Diary */}
            <button
              onClick={() => scrollToSection(diaryRef)}
              className="flex flex-col items-center group"
            >
              <span className="text-xl font-bold text-foreground group-active:scale-95 transition-transform">
                {Math.round(totalPaths)}
              </span>
              <span className="text-xs text-muted-foreground/80 font-medium lowercase">
                cose comprese
              </span>
            </button>

            {/* Vertical Divider */}
            <div className="h-8 w-[1px] bg-border/50" />

            {/* Ambiti esplorati -> Scroll to Nebula */}
            <button
              onClick={() => scrollToSection(nebulaRef)}
              className="flex flex-col items-center group"
            >
              <span className="text-xl font-bold text-foreground group-active:scale-95 transition-transform">
                {activeTopics}
              </span>
              <span className="text-xs text-muted-foreground/80 font-medium lowercase">
                ambiti esplorati
              </span>
            </button>

            {/* Vertical Divider */}
            <div className="h-8 w-[1px] bg-border/50" />

            {/* Persone seguite -> Open Connections */}
            <button
              onClick={openConnections}
              className="flex flex-col items-center group"
            >
              <span className="text-xl font-bold text-foreground group-active:scale-95 transition-transform">
                {stats?.following || 0}
              </span>
              <span className="text-xs text-muted-foreground/80 font-medium lowercase">
                persone seguite
              </span>
            </button>

          </div>
        </div>

        {/* Compact Cognitive Nebula (expandable) */}
        <div ref={nebulaRef} className="px-4 mb-4 scroll-mt-20">
          <CompactNebula
            data={cognitiveDensity}
            onClick={() => setShowNebulaExpanded(true)}
          />
        </div>

        {/* Cognitive Diary */}
        <div ref={diaryRef} className="px-4 pb-6 scroll-mt-20">
          <div className="mb-3">
            <h3 className="text-base font-semibold">Diario Cognitivo</h3>
            <p className="text-xs text-muted-foreground">
              Tutto ciò che hai compreso, condiviso e creato.
            </p>
          </div>

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
                {diaryFilter === 'all'
                  ? 'Nessun contenuto nel tuo diario. Inizia a creare o condividere!'
                  : 'Nessun contenuto per questo filtro.'}
              </p>
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
