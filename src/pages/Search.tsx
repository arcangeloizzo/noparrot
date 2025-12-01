import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/navigation/Header";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchTabs, SearchTab } from "@/components/search/SearchTabs";
import { SearchResults } from "@/components/search/SearchResults";
import { SearchFilters, SearchFiltersState } from "@/components/search/SearchFilters";
import { QuickFilters } from "@/components/search/QuickFilters";
import { TrendingTopicCard } from "@/components/search/TrendingTopicCard";
import { useTrendingTopics } from "@/hooks/useTrendingTopics";
import { Skeleton } from "@/components/ui/skeleton";

export const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get("q") || "";
  const tabParam = (searchParams.get("tab") || "posts") as SearchTab;
  
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

  const { data: trendingTopics, isLoading } = useTrendingTopics();

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

  const handleTopicClick = (category: string) => {
    const query = `#${category}`;
    setSearchQuery(query);
    setSearchParams({ q: query, tab: "posts" });
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
                Le discussioni più attive degli ultimi 7 giorni
              </p>
            </div>
            
            <div className="space-y-3">
              {isLoading ? (
                // Loading skeletons
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-muted rounded-xl p-4 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))
              ) : trendingTopics && trendingTopics.length > 0 ? (
                trendingTopics.map((topic) => (
                  <TrendingTopicCard
                    key={topic.category}
                    title={topic.category}
                    summary={topic.summary}
                    postCount={topic.postCount}
                    onClick={() => handleTopicClick(topic.category)}
                  />
                ))
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
            />
          </div>
        )}
      </div>
    </div>
  );
};
