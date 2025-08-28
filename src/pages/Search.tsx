import { useState } from "react";
import { SearchIcon, TrendingUpIcon, HashIcon } from "@/components/ui/icons";
import { FeedCard } from "@/components/feed/FeedCard";
import { mockPosts } from "@/data/mockData";
import { cn } from "@/lib/utils";

export const Search = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "people" | "posts">("all");

  const recentSearches = ["AI", "Politica", "Economia", "Sport"];
  const trendingTopics = [
    { topic: "Intelligenza Artificiale", posts: "1,234 post" },
    { topic: "Elezioni 2024", posts: "892 post" },
    { topic: "Cambiamento Climatico", posts: "567 post" },
    { topic: "Tecnologia", posts: "445 post" },
    { topic: "Salute", posts: "332 post" },
  ];

  const filteredPosts = mockPosts.slice(0, 5); // Show top 5 posts

  return (
    <div className="min-h-screen bg-background">
      <div className="mobile-container">
        {/* Search Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border/50">
          <div className="p-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cerca su NOPARROT"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-muted rounded-full border-0 focus:ring-2 focus:ring-primary-blue focus:outline-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* Search Results or Default Content */}
        {searchQuery.length > 0 ? (
          <div className="p-4">
            {/* Search Tabs */}
            <div className="flex space-x-1 mb-6 bg-muted rounded-full p-1">
              {[
                { id: "all", label: "Tutto" },
                { id: "people", label: "Persone" },
                { id: "posts", label: "Post" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors",
                    activeTab === id
                      ? "bg-primary-blue text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Search Results */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Post principali</h3>
              {filteredPosts.map((post) => (
                <FeedCard
                  key={post.id}
                  post={post}
                  scale={0.95}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Recent Searches */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Ricerche recenti</h3>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search) => (
                  <button
                    key={search}
                    onClick={() => setSearchQuery(search)}
                    className="px-4 py-2 bg-muted rounded-full text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>

            {/* Trending Topics */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <TrendingUpIcon className="w-5 h-5 text-primary-blue" />
                <h3 className="text-lg font-semibold text-foreground">Tendenze per te</h3>
              </div>
              <div className="space-y-3">
                {trendingTopics.map((trend, index) => (
                  <button
                    key={index}
                    onClick={() => setSearchQuery(trend.topic)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <div className="flex items-start space-x-3">
                      <HashIcon className="w-5 h-5 text-muted-foreground mt-0.5 group-hover:text-primary-blue transition-colors" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground group-hover:text-primary-blue transition-colors">
                          {trend.topic}
                        </p>
                        <p className="text-sm text-muted-foreground">{trend.posts}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};