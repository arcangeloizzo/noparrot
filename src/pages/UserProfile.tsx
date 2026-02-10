import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { CompactNebula } from "@/components/profile/CompactNebula";
import { NebulaExpandedSheet } from "@/components/profile/NebulaExpandedSheet";
import { ConnectionsSheet } from "@/components/profile/ConnectionsSheet";
import { DiaryEntry, DiaryEntryData, DiaryEntryType } from "@/components/profile/DiaryEntry";
import { DiaryFilters, DiaryFilterType } from "@/components/profile/DiaryFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { getDisplayUsername } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { recalculateCognitiveDensityFromPosts } from "@/lib/cognitiveDensity";

export const UserProfile = () => {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
        .select("id, username, full_name, avatar_url, bio, created_at")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch cognitive density separately - this is allowed since it's in a user's public activity
  // The cognitive density is calculated from public posts, not private profile data
  const { data: cognitiveDensityData } = useQuery({
    queryKey: ["user-cognitive-density", userId],
    queryFn: async () => {
      // Recalculate from posts instead of accessing private profile data
      const result = await recalculateCognitiveDensityFromPosts(userId!);
      return result || {};
    },
    enabled: !!userId && !!profile,
  });

  const { data: stats } = useQuery({
    queryKey: ["user-stats", userId],
    queryFn: async () => {
      if (!userId) return { following: 0, followers: 0, posts: 0, activeTopics: 0 };

      const [followingRes, followersRes, postsRes] = await Promise.all([
        supabase.from("followers").select("id", { count: "exact" }).eq("follower_id", userId),
        supabase.from("followers").select("id", { count: "exact" }).eq("following_id", userId),
        supabase.from("posts").select("id", { count: "exact" }).eq("author_id", userId),
      ]);

      const cogDensity = cognitiveDensityData || {};
      const activeTopics = Object.values(cogDensity).filter(val => val > 0).length;

      return {
        following: followingRes.count || 0,
        followers: followersRes.count || 0,
        posts: postsRes.count || 0,
        activeTopics,
      };
    },
    enabled: !!userId && !!profile && !!cognitiveDensityData,
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
          sources, preview_img, created_at, category
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
            sources, preview_img, created_at, category, author_id)
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

      // Map gated posts (not authored by this user)
      const gatedEntries: DiaryEntryData[] = (gatedPosts || [])
        .filter(g => g.posts.author_id !== userId)
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
    enabled: !!userId,
  });

  // Filter diary entries
  const filteredEntries = diaryEntries.filter(entry => {
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

  if (!userId) {
    navigate('/');
    return null;
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

  const cognitiveDensity = cognitiveDensityData || {};
  const totalPaths = Object.values(cognitiveDensity).reduce((sum, val) => sum + val, 0);
  const activeTopics = Object.values(cognitiveDensity).filter(val => val > 0).length;

  const displayName = profile?.full_name?.trim() && !profile.full_name.includes('@') && profile.full_name.includes(' ')
    ? profile.full_name
    : getDisplayUsername(profile?.username || '');

  return (
    <div className="min-h-screen bg-background pb-24 urban-texture">
      <div className="max-w-[600px] mx-auto">
        {/* Header - Back Button, Avatar, Name, Bio, Follow Button */}
        <div className="px-6 pt-6 pb-4">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover shadow-[0_0_20px_rgba(10,122,255,0.15)] ring-2 ring-white/10"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-2xl font-semibold text-primary-foreground shadow-[0_0_20px_rgba(10,122,255,0.15)] ring-2 ring-white/10">
                  {getInitials(displayName)}
                </div>
              )}
            </div>

            {/* Name, Bio & Follow Button */}
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-xl font-bold truncate">{displayName}</h1>
              {profile?.bio && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                  {profile.bio}
                </p>
              )}

              {/* Follow Button inline */}
              {currentUser && (
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  size="sm"
                  className="mt-2 rounded-full"
                  onClick={() => toggleFollowMutation.mutate()}
                  disabled={toggleFollowMutation.isPending}
                >
                  {isFollowing ? "Non seguire più" : "Segui"}
                </Button>
              )}
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

            {/* Follower -> Open Connections */}
            <button
              onClick={openFollowers}
              className="flex flex-col items-center group"
            >
              <span className="text-xl font-bold text-foreground group-active:scale-95 transition-transform">
                {stats?.followers || 0}
              </span>
              <span className="text-xs text-muted-foreground/80 font-medium lowercase">
                follower
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
              I percorsi di comprensione di {displayName}.
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
                  ? 'Nessun contenuto nel diario.'
                  : 'Nessun contenuto per questo filtro.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Nebula Expanded Sheet */}
      <NebulaExpandedSheet
        open={showNebulaExpanded}
        onOpenChange={setShowNebulaExpanded}
        cognitiveDensity={cognitiveDensity}
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
