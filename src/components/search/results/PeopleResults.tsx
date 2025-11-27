import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { Link } from "react-router-dom";
import { getDisplayUsername } from "@/lib/utils";

interface PeopleResultsProps {
  query: string;
}

export const PeopleResults = ({ query }: PeopleResultsProps) => {
  const { data: users, isLoading, error } = useQuery({
    queryKey: ["search-people", query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      console.log('🔍 [PeopleResults] Searching for:', query);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, bio")
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%,bio.ilike.%${query}%`)
        .limit(20);

      if (error) {
        console.error("❌ [PeopleResults] Search error:", error);
        throw error;
      }

      console.log('✅ [PeopleResults] Found', data?.length || 0, 'users');
      
      // Clean usernames to hide emails
      const cleanedData = data?.map(user => ({
        ...user,
        username: getDisplayUsername(user.username)
      }));

      return cleanedData || [];
    },
    enabled: !!query && query.length >= 2,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4 border-b border-border">
            <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-muted rounded animate-pulse mb-2" />
              <div className="h-3 w-48 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Errore nella ricerca</p>
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Nessun utente trovato per "{query}"</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {users.map((user) => (
        <Link
          key={user.id}
          to={`/profile/${user.id}`}
          className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
        >
          <Avatar className="w-12 h-12">
            <AvatarImage src={user.avatar_url || undefined} alt={user.username} />
            <AvatarFallback>
              <User className="w-6 h-6" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">
                {user.full_name || user.username}
              </p>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              @{user.username}
            </p>
            {user.bio && (
              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                {user.bio}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" className="rounded-full shrink-0">
            Segui
          </Button>
        </Link>
      ))}
    </div>
  );
};
