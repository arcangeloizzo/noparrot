import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { TrustBadge } from "@/components/ui/trust-badge";

interface SourcesResultsProps {
  query: string;
}

export const SourcesResults = ({ query }: SourcesResultsProps) => {
  const { data: sources, isLoading } = useQuery({
    queryKey: ["search-sources", query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      // Get all posts with URLs that match the query
      const { data: posts, error } = await supabase
        .from("posts")
        .select("shared_url, trust_level")
        .not("shared_url", "is", null)
        .ilike("shared_url", `%${query}%`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Extract domains and count occurrences
      const domainData = (posts || []).reduce((acc: Record<string, { count: number; trustScores: number[] }>, post) => {
        if (!post.shared_url) return acc;
        
        try {
          const url = new URL(post.shared_url);
          const domain = url.hostname.replace("www.", "");
          
          if (!acc[domain]) {
            acc[domain] = { count: 0, trustScores: [] };
          }
          
          acc[domain].count++;
          
          // Map trust levels to scores
          if (post.trust_level === "ALTO") {
            acc[domain].trustScores.push(90);
          } else if (post.trust_level === "MEDIO") {
            acc[domain].trustScores.push(60);
          } else if (post.trust_level === "BASSO") {
            acc[domain].trustScores.push(30);
          }
        } catch (e) {
          // Invalid URL, skip
        }
        
        return acc;
      }, {});

      // Convert to array and calculate average trust scores
      return Object.entries(domainData)
        .map(([domain, data]) => {
          const avgScore = data.trustScores.length > 0
            ? Math.round(data.trustScores.reduce((a, b) => a + b, 0) / data.trustScores.length)
            : 50;
          
          const trustBand = avgScore >= 80 ? "ALTO" as const : avgScore >= 50 ? "MEDIO" as const : "BASSO" as const;
          
          return {
            domain,
            posts: data.count,
            trustScore: avgScore,
            trustBand,
          };
        })
        .sort((a, b) => b.posts - a.posts)
        .slice(0, 20);
    },
    enabled: !!query && query.length >= 2,
  });

  if (isLoading || !sources || sources.length === 0) {
    return null;
  }

  return (
    <div className="divide-y divide-border">
      {sources.map((source) => (
        <Link
          key={source.domain}
          to={`/search?q=${encodeURIComponent(`site:${source.domain}`)}&tab=posts`}
          className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors group"
        >
          {/* Favicon */}
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img
              src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=64`}
              alt=""
              className="w-8 h-8"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
              }}
            />
            <ExternalLink className="w-6 h-6 text-muted-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold truncate">{source.domain}</span>
              {source.posts > 5 && (
                <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {source.posts} post
            </div>
          </div>

          <TrustBadge
            score={source.trustScore}
            band={source.trustBand}
          />
        </Link>
      ))}
    </div>
  );
};
