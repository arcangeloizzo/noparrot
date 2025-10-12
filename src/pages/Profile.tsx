import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { FeedCard } from "@/components/feed/FeedCard";
import { cn, getDisplayUsername } from "@/lib/utils";

export const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"posts" | "replies">("posts");

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) {
        console.error("Profile query error:", error);
        throw error;
      }
      return data;
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    queryFn: async () => {
      if (!user) return { following: 0, followers: 0, posts: 0 };

      const [followingRes, followersRes, postsRes] = await Promise.all([
        supabase.from("followers").select("id", { count: "exact" }).eq("follower_id", user.id),
        supabase.from("followers").select("id", { count: "exact" }).eq("following_id", user.id),
        supabase.from("posts").select("id", { count: "exact" }).eq("author_id", user.id),
      ]);

      return {
        following: followingRes.count || 0,
        followers: followersRes.count || 0,
        posts: postsRes.count || 0,
      };
    },
    enabled: !!user,
  });

  const { data: userPosts = [], error: postsError } = useQuery({
    queryKey: ["user-posts", user?.id],
    queryFn: async () => {
      if (!user) return [];
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
        console.error("Posts query error:", error);
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
    },
    enabled: !!user,
  });

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

  if (!user || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
                {profile?.full_name?.trim() && !profile.full_name.includes('.') 
                  ? profile.full_name 
                  : `@${getDisplayUsername(profile?.username || '')}`
                }
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
                {getInitials(profile?.full_name || "")}
              </div>
            )}
          </div>

          {/* Edit Profile Button */}
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => navigate("/profile/edit")}
            >
              Modifica profilo
            </Button>
          </div>

          {/* Nome e username */}
          <div className="mb-3">
            <h2 className="text-xl font-bold">
              {profile?.full_name?.trim() && !profile.full_name.includes('.') 
                ? profile.full_name 
                : `@${getDisplayUsername(profile?.username || '')}`
              }
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
            <button className="hover:underline">
              <span className="font-semibold">{stats?.following || 0}</span>{" "}
              <span className="text-muted-foreground">Following</span>
            </button>
            <button className="hover:underline">
              <span className="font-semibold">{stats?.followers || 0}</span>{" "}
              <span className="text-muted-foreground">Follower</span>
            </button>
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

      <BottomNavigation activeTab="profile" onTabChange={() => {}} onProfileClick={() => {}} />
    </div>
  );
};

export default Profile;
