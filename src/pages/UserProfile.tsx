import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { FeedCard } from "@/components/feed/FeedCardAdapt";
import { cn, getDisplayUsername } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export const UserProfile = () => {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"posts" | "replies">("posts");

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
      if (!userId) return { following: 0, followers: 0, posts: 0 };

      const [followingRes, followersRes, postsRes] = await Promise.all([
        supabase.from("followers").select("id", { count: "exact" }).eq("follower_id", userId),
        supabase.from("followers").select("id", { count: "exact" }).eq("following_id", userId),
        supabase.from("posts").select("id", { count: "exact" }).eq("author_id", userId),
      ]);

      return {
        following: followingRes.count || 0,
        followers: followersRes.count || 0,
        posts: postsRes.count || 0,
      };
    },
    enabled: !!userId,
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

  const { data: userPosts = [] } = useQuery({
    queryKey: ["user-posts", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("posts")
        .select(`
          *,
          author:profiles!author_id(id, username, full_name, avatar_url),
          reactions:reactions(reaction_type, user_id),
          comments:comments(id)
        `)
        .eq("author_id", userId)
        .order("created_at", { ascending: false });
      
      if (error) return [];
      
      return data?.map(post => ({
        ...post,
        author: post.author,
        reactions: {
          hearts: post.reactions?.filter((r: any) => r.reaction_type === 'heart').length || 0,
          comments: post.comments?.length || 0,
        },
        user_reactions: {
          has_hearted: post.reactions?.some((r: any) => r.reaction_type === 'heart' && r.user_id === currentUser?.id) || false,
          has_bookmarked: post.reactions?.some((r: any) => r.reaction_type === 'bookmark' && r.user_id === currentUser?.id) || false,
        }
      })) || [];
    },
    enabled: !!userId,
  });

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

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-[600px] mx-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-50 border-b border-border">
          <div className="flex items-center p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="ml-4">
              <h1 className="text-xl font-bold">
                {profile?.full_name?.trim() && !profile.full_name.includes('@') && profile.full_name.includes(' ')
                  ? profile.full_name 
                  : getDisplayUsername(profile?.username || '')}
              </h1>
              <p className="text-sm text-muted-foreground">{stats?.posts || 0} Post</p>
            </div>
          </div>
        </div>

        {/* Cover Image */}
        <div className="h-48 bg-primary/10" />

        {/* Profile Info */}
        <div className="px-4 pb-4 border-b border-border">
          {/* Avatar */}
          <div className="relative -mt-16 mb-4">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-32 h-32 rounded-full border-4 border-background object-cover"
              />
            ) : (
              <div className="w-32 h-32 rounded-full border-4 border-background bg-primary flex items-center justify-center text-4xl font-semibold text-primary-foreground">
                {getInitials(getDisplayUsername(profile?.username || "U"))}
              </div>
            )}
          </div>

          {/* Follow Button */}
          {currentUser && (
            <div className="flex justify-end mb-4">
              <Button
                variant={isFollowing ? "outline" : "default"}
                className="rounded-full"
                onClick={() => toggleFollowMutation.mutate()}
                disabled={toggleFollowMutation.isPending}
              >
                {isFollowing ? "Non seguire più" : "Segui"}
              </Button>
            </div>
          )}

          {/* Nome e username */}
          <div className="mb-3">
            <h2 className="text-xl font-bold">
              {profile?.full_name?.trim() && !profile.full_name.includes('@') && profile.full_name.includes(' ')
                ? profile.full_name 
                : getDisplayUsername(profile?.username || '')}
            </h2>
            <p className="text-muted-foreground">@{getDisplayUsername(profile?.username || '')}</p>
          </div>

          {/* Bio */}
          {profile?.bio && <p className="mb-3 whitespace-pre-wrap">{profile.bio}</p>}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3 flex-wrap">
            {profile?.date_of_birth && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>
                  Nato il{" "}
                  {new Date(profile.date_of_birth).toLocaleDateString("it-IT", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
            {profile?.created_at && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>
                  Iscritto a{" "}
                  {new Date(profile.created_at).toLocaleDateString("it-IT", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Following/Follower */}
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="font-semibold">{stats?.following || 0}</span>{" "}
              <span className="text-muted-foreground">Following</span>
            </div>
            <div>
              <span className="font-semibold">{stats?.followers || 0}</span>{" "}
              <span className="text-muted-foreground">Follower</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            className={cn(
              "flex-1 py-4 text-sm font-semibold transition-colors relative",
              activeTab === "posts" ? "text-foreground" : "text-muted-foreground hover:bg-muted/50"
            )}
            onClick={() => setActiveTab("posts")}
          >
            Post
            {activeTab === "posts" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />
            )}
          </button>
          <button
            className={cn(
              "flex-1 py-4 text-sm font-semibold transition-colors relative",
              activeTab === "replies" ? "text-foreground" : "text-muted-foreground hover:bg-muted/50"
            )}
            onClick={() => setActiveTab("replies")}
          >
            Risposte
            {activeTab === "replies" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="divide-y divide-border">
          {activeTab === "posts" && (
            <>
              {userPosts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <p>Nessun post ancora</p>
                </div>
              ) : (
                userPosts.map((post: any) => (
                  <FeedCard key={post.id} post={post} />
                ))
              )}
            </>
          )}
          {activeTab === "replies" && (
            <div className="py-12 text-center text-muted-foreground">
              <p>Nessuna risposta ancora</p>
            </div>
          )}
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
