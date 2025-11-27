import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { ProfileSideSheet } from "@/components/navigation/ProfileSideSheet";
import { CognitiveMap } from "@/components/profile/CognitiveMap";
import { CognitiveIdentity } from "@/components/profile/CognitiveIdentity";
import { SharedPaths } from "@/components/profile/SharedPaths";
import { getDisplayUsername } from "@/lib/utils";
import { recalculateCognitiveDensityFromPosts } from "@/lib/cognitiveDensity";

export const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [navTab, setNavTab] = useState("");
  const [showProfileSheet, setShowProfileSheet] = useState(false);

  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) {
        throw new Error("Not authenticated");
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (error) {
        console.error("❌ Profile fetch error:", error);
        throw error;
      }
      console.log("✅ Profile fetched:", data);
      return data;
    },
    enabled: !!user,
  });

  // Ricalcola cognitive density se vuoto - separato in useEffect
  useEffect(() => {
    const recalculateIfNeeded = async () => {
      if (profile && user?.id) {
        const density = profile.cognitive_density as Record<string, number> | null;
        const isEmpty = !density || Object.keys(density).length === 0;
        
        if (isEmpty) {
          console.log('🔄 Cognitive density vuoto, ricalcolo dai post...');
          const result = await recalculateCognitiveDensityFromPosts(user.id);
          
          if (result && Object.keys(result).length > 0) {
            console.log('✅ Cognitive density ricalcolato:', result);
            // Invalida la query per forzare refetch
            queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
          } else {
            console.log('⚠️ Nessun post con categoria trovato');
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

      // Calcola ambiti attivi dalla cognitive density
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

  const { data: userPosts = [], error: postsError } = useQuery({
    queryKey: ["user-posts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      try {
        const { data, error } = await supabase
          .from("posts")
          .select(`
            *,
            author:profiles!author_id(id, username, full_name, avatar_url),
            reactions:reactions(reaction_type, user_id),
            comments:comments(id)
          `)
          .eq("author_id", user.id)
          .order("created_at", { ascending: false });
        
        if (error) {
          console.error("❌ Posts query error:", error);
          return [];
        }
        
        // Format the posts to match the Post type
        const formattedPosts = data?.map(post => ({
          ...post,
          author: post.author,
          reactions: {
            hearts: post.reactions?.filter((r: any) => r.reaction_type === 'heart').length || 0,
            comments: post.comments?.length || 0,
          },
          user_reactions: {
            has_hearted: post.reactions?.some((r: any) => r.reaction_type === 'heart' && r.user_id === user.id) || false,
            has_bookmarked: post.reactions?.some((r: any) => r.reaction_type === 'bookmark' && r.user_id === user.id) || false,
          }
        })) || [];
        
        return formattedPosts;
      } catch (err) {
        console.error("❌ Exception fetching posts:", err);
        return [];
      }
    },
    enabled: !!user,
  });

  // Debug logging
  useEffect(() => {
    console.log("🔍 Profile render state:", {
      hasProfile: !!profile,
      hasStats: !!stats,
      userPostsCount: userPosts?.length || 0,
      isLoading,
      hasError: !!error,
      hasPostsError: !!postsError
    });
  }, [profile, stats, userPosts, isLoading, error, postsError]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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

  console.log("🎨 Rendering Profile - Stats:", { 
    followers: stats?.followers, 
    following: stats?.following,
    posts: stats?.posts,
    userPostsLength: userPosts?.length 
  });

  const cognitiveDensity = (profile?.cognitive_density as Record<string, number>) || {};
  const totalPaths = Object.values(cognitiveDensity).reduce((sum, val) => sum + val, 0);
  const activeTopics = Object.values(cognitiveDensity).filter(val => val > 0).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-[600px] mx-auto">
        {/* Header centrato con sottotitolo cognitivo */}
        <div className="px-6 pt-12 pb-6 text-center">
          {/* Avatar grande con alone cognitivo */}
          <div className="flex justify-center mb-4">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover shadow-[0_0_20px_rgba(10,122,255,0.15)]"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-3xl font-semibold text-primary-foreground shadow-[0_0_20px_rgba(10,122,255,0.15)]">
                {getInitials(getDisplayUsername(profile?.username || "U"))}
              </div>
            )}
          </div>

          <h1 className="text-2xl font-bold mb-2">
            {profile?.full_name?.trim() && !profile.full_name.includes('@') && profile.full_name.includes(' ')
              ? profile.full_name 
              : getDisplayUsername(profile?.username || '')}
          </h1>
          <p className="text-xs text-[#9AA3AB] tracking-wide">
            In cammino verso una comprensione più chiara.
          </p>
        </div>

        {/* Micro-cards: Percorsi / Ambiti / Connessioni */}
        <div className="px-4 mb-8">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#141A1E] p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-foreground mb-1">{totalPaths}</div>
              <div className="text-xs text-muted-foreground">Percorsi completati</div>
            </div>
            <div className="bg-[#141A1E] p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-foreground mb-1">{activeTopics}</div>
              <div className="text-xs text-muted-foreground">Ambiti attivi</div>
            </div>
            <div className="bg-[#141A1E] p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-foreground mb-1">{stats?.following || 0}</div>
              <div className="text-xs text-muted-foreground">Connessioni</div>
            </div>
          </div>
        </div>

        {/* Nebulosa Cognitiva */}
        <div className="px-6 py-8 border-t border-border">
          <CognitiveMap cognitiveDensity={cognitiveDensity} />
        </div>

        {/* Identità Cognitiva */}
        <div className="px-6 py-8 border-t border-border">
          <CognitiveIdentity cognitiveDensity={cognitiveDensity} />
        </div>

        {/* Percorsi condivisi */}
        <div className="px-6 py-8 border-t border-border">
          <SharedPaths posts={userPosts} />
        </div>

        {/* Modifica profilo discreto in fondo */}
        <div className="px-6 py-8 border-t border-border flex justify-center">
          <Button
            variant="outline"
            className="rounded-full text-sm"
            onClick={() => navigate("/profile/edit")}
          >
            Modifica profilo
          </Button>
        </div>
      </div>

      <BottomNavigation 
        activeTab={navTab} 
        onTabChange={(tab) => {
          if (tab === 'home') navigate('/');
          else if (tab === 'search') navigate('/search');
          else if (tab === 'saved') navigate('/saved');
          else if (tab === 'notifications') navigate('/notifications');
        }}
        onProfileClick={() => setShowProfileSheet(true)}
      />
      
      {/* Profile Sheet */}
      <ProfileSideSheet 
        isOpen={showProfileSheet}
        onClose={() => setShowProfileSheet(false)}
      />
    </div>
  );
};

export default Profile;
