import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { CognitiveMap } from "@/components/profile/CognitiveMap";
import { getDisplayUsername } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { recalculateCognitiveDensityFromPosts } from "@/lib/cognitiveDensity";
import { useEffect } from "react";

export const UserProfile = () => {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
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

  // Ricalcola cognitive density se vuoto
  useEffect(() => {
    const recalculateIfNeeded = async () => {
      if (profile && userId) {
        const density = profile.cognitive_density as Record<string, number> | null;
        const isEmpty = !density || Object.keys(density).length === 0;
        
        if (isEmpty) {
          console.log('🔄 [UserProfile] Cognitive density vuoto, ricalcolo dai post...');
          const result = await recalculateCognitiveDensityFromPosts(userId);
          
          if (result && Object.keys(result).length > 0) {
            console.log('✅ [UserProfile] Cognitive density ricalcolato:', result);
            queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
          }
        }
      }
    };
    recalculateIfNeeded();
  }, [profile, userId, queryClient]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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

  const cognitiveDensity = (profile?.cognitive_density as Record<string, number>) || {};
  const totalPaths = Object.values(cognitiveDensity).reduce((sum, val) => sum + val, 0);
  const activeTopics = Object.values(cognitiveDensity).filter(val => val > 0).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-[600px] mx-auto">
        {/* Header con freccia indietro */}
        <div className="px-6 pt-6 pb-4 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>

        {/* Header centrato con avatar e nome */}
        <div className="px-6 pb-6 text-center">
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
          <p className="text-xs text-[#9AA3AB] tracking-wide mb-4">
            {profile?.bio || 'I suoi percorsi di comprensione'}
          </p>

          {/* Pulsante Segui */}
          {currentUser && (
            <Button
              variant={isFollowing ? "outline" : "default"}
              className="rounded-full"
              onClick={() => toggleFollowMutation.mutate()}
              disabled={toggleFollowMutation.isPending}
            >
              {isFollowing ? "Non seguire più" : "Segui"}
            </Button>
          )}
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
              <div className="text-2xl font-bold text-foreground mb-1">{stats?.followers || 0}</div>
              <div className="text-xs text-muted-foreground">Connessioni</div>
            </div>
          </div>
        </div>

        {/* Nebulosa Cognitiva */}
        <div className="px-6 py-8 border-t border-border">
          <CognitiveMap cognitiveDensity={cognitiveDensity} />
        </div>
      </div>

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
