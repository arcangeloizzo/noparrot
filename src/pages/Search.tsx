import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Header } from "@/components/navigation/Header";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchTabs, SearchTab } from "@/components/search/SearchTabs";
import { SearchResults } from "@/components/search/SearchResults";
import { SearchFilters, SearchFiltersState } from "@/components/search/SearchFilters";
import { QuickFilters } from "@/components/search/QuickFilters";
import { TrendingTopicCard } from "@/components/search/TrendingTopicCard";
import { useTrendingTopics } from "@/hooks/useTrendingTopics";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

export const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get("q") || "";
  const tabParam = (searchParams.get("tab") || "posts") as SearchTab;
  const typeParam = searchParams.get("type") as "text" | "category" | null;
  
  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [activeTab, setActiveTab] = useState<SearchTab>(tabParam);
  const [filters, setFilters] = useState<SearchFiltersState>({
    dateRange: "30days",
    language: "auto",
    contentType: [],
    trustScore: "all",
    sortBy: "relevance"
  });
  const [quickFilters, setQuickFilters] = useState<string[]>([]);

  const handleQuickFilterToggle = (filter: string) => {
    setQuickFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const { data: trendingData, isLoading } = useTrendingTopics();

  // Sync URL params with state
  useEffect(() => {
    setSearchQuery(queryParam);
    setActiveTab(tabParam);
  }, [queryParam, tabParam]);

  const handleSearch = (query: string) => {
    console.log("Searching for:", query);
    
    // Save to recent searches
    const recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    if (query && !recentSearches.includes(query)) {
      const updated = [query, ...recentSearches].slice(0, 5);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
    }

    // Update URL params
    setSearchParams({ q: query, tab: activeTab });
  };

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
    if (searchQuery) {
      setSearchParams({ q: searchQuery, tab });
    }
  };

  const handleTopicClick = (topicId: string, title: string) => {
    setSearchQuery(title);
    setSearchParams({ q: title, tab: "posts", type: "category" });
  };

  const hasActiveQuery = searchQuery.trim().length > 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <div className="mobile-container max-w-[600px] mx-auto">
        {/* Sticky Search Bar */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-20 p-4">
          <SearchBar 
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
          />
        </div>

        {!hasActiveQuery ? (
          /* Trending Topics View */
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>🔥</span>
                <span>Di cosa parla la community</span>
              </h2>
              <p className="text-sm text-muted-foreground">
                {trendingData?.mode === 'TRENDING' 
                  ? 'Le discussioni più attive degli ultimi 7 giorni'
                  : 'Scopri cosa sta succedendo'
                }
              </p>
            </div>
            
            <div className="space-y-3">
              {isLoading ? (
                // Loading skeletons
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-muted rounded-xl p-4 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))
              ) : trendingData?.mode === 'TRENDING' && trendingData.topics && trendingData.topics.length > 0 ? (
                // Trending Topics mode
                trendingData.topics.map((topic) => (
                  <TrendingTopicCard
                    key={topic.topic_id}
                    title={topic.title}
                    summary={topic.summary}
                    badgeCategory={topic.badge_category}
                    postCount={topic.stats.posts}
                    commentCount={topic.stats.comments}
                    onClick={() => handleTopicClick(topic.topic_id, topic.title)}
                  />
                ))
              ) : trendingData?.mode === 'RECENT_POSTS' && trendingData.recentPosts && trendingData.recentPosts.length > 0 ? (
                // Recent Posts fallback mode
                <div className="space-y-4">
                  <div className="text-center py-4 px-6 bg-primary/5 rounded-xl border border-primary/10">
                    <Sparkles className="w-6 h-6 text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      La community sta iniziando a muoversi
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Esplora gli ultimi post e inizia una discussione
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Post recenti</h3>
                    {trendingData.recentPosts.map((post) => (
                      <Link
                        key={post.id}
                        to={`/post/${post.id}`}
                        className="block p-3 bg-[#151F2B] rounded-lg border border-white/5 hover:border-white/10 transition-colors"
                      >
                        <p className="text-sm text-white line-clamp-2">
                          {post.shared_title || post.content}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nessuna discussione attiva al momento</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Search Results View */
          <div className="space-y-4">
            {/* Tabs */}
            <SearchTabs activeTab={activeTab} onTabChange={handleTabChange} />

            {/* Filters */}
            <div className="px-4 space-y-3">
              <QuickFilters
                activeFilters={quickFilters}
                onToggle={handleQuickFilterToggle}
              />
              <SearchFilters
                filters={filters}
                onFiltersChange={setFilters}
              />
            </div>

            {/* Results */}
            <SearchResults
              query={searchQuery}
              tab={activeTab}
              filters={filters}
              quickFilters={quickFilters}
              searchType={typeParam || undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
};
