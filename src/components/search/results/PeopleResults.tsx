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
  const { data: users, isLoading } = useQuery({
    queryKey: ["search-people", query],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, bio")
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%,bio.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;

      return data?.map(user => ({
        ...user,
        username: getDisplayUsername(user.username)
      })) || [];
    },
    enabled: !!query,
  });

  if (isLoading || !users || users.length === 0) {
    return null;
  }

  return (
    <div className="divide-y divide-border">
      {users.map((user) => (
        <Link
          key={user.id}
          to={`/profile/${user.username}`}
          className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
        >
          <Avatar className="w-12 h-12 flex-shrink-0">
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback><User className="w-6 h-6" /></AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{user.full_name}</div>
            <div className="text-sm text-muted-foreground truncate">@{user.username}</div>
            {user.bio && (
              <div className="text-sm text-muted-foreground line-clamp-1 mt-1">
                {user.bio}
              </div>
            )}
          </div>

          <Button size="sm" variant="outline" onClick={(e) => {
            e.preventDefault();
            // Follow/unfollow logic here
          }}>
            Segui
          </Button>
        </Link>
      ))}
    </div>
  );
};
