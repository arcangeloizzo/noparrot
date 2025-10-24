import { ExternalLink, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { TrustBadge } from "@/components/ui/trust-badge";

interface SourcesResultsProps {
  query: string;
}

const MOCK_SOURCES = [
  { domain: "ilpost.it", posts: 234, trustScore: 90, trustBand: "ALTO" as const },
  { domain: "repubblica.it", posts: 189, trustScore: 85, trustBand: "ALTO" as const },
  { domain: "corriere.it", posts: 156, trustScore: 88, trustBand: "ALTO" as const },
  { domain: "ansa.it", posts: 143, trustScore: 92, trustBand: "ALTO" as const },
  { domain: "reuters.com", posts: 98, trustScore: 95, trustBand: "ALTO" as const },
  { domain: "bbc.com", posts: 87, trustScore: 90, trustBand: "ALTO" as const },
  { domain: "nytimes.com", posts: 76, trustScore: 88, trustBand: "ALTO" as const },
  { domain: "theguardian.com", posts: 65, trustScore: 87, trustBand: "ALTO" as const },
];

export const SourcesResults = ({ query }: SourcesResultsProps) => {
  const filteredSources = query
    ? MOCK_SOURCES.filter(s => s.domain.toLowerCase().includes(query.toLowerCase()))
    : MOCK_SOURCES;

  if (filteredSources.length === 0) {
    return null;
  }

  return (
    <div className="divide-y divide-border">
      {filteredSources.map((source) => (
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
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = `<${ExternalLink} class="w-6 h-6 text-muted-foreground" />`;
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold truncate">{source.domain}</span>
              {source.posts > 100 && (
                <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {source.posts.toLocaleString()} post
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
