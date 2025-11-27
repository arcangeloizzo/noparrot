import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/navigation/Header";
import { SearchBar } from "@/components/search/SearchBar";
import { QuickFilters } from "@/components/search/QuickFilters";
import { SearchTabs, SearchTab } from "@/components/search/SearchTabs";
import { SearchFilters, SearchFiltersState } from "@/components/search/SearchFilters";
import { SearchResults } from "@/components/search/SearchResults";
import { CategoryExplorer } from "@/components/search/CategoryExplorer";
import { usePosts } from "@/hooks/usePosts";
import { FeedCard } from "@/components/feed/FeedCardAdapt";

const defaultFilters: SearchFiltersState = {
  dateRange: "30days",
  language: "auto",
  contentType: [],
  trustScore: "all",
  sortBy: "relevance",
};

export const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [activeTab, setActiveTab] = useState<SearchTab>(
    (searchParams.get("tab") as SearchTab) || "posts"
  );
  const [filters, setFilters] = useState<SearchFiltersState>(defaultFilters);
  const [quickFilters, setQuickFilters] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const { data: posts = [] } = usePosts();

  // Sync URL with state
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (activeTab !== "posts") params.set("tab", activeTab);
    setSearchParams(params, { replace: true });
  }, [query, activeTab, setSearchParams]);

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    
    // Save to recent searches
    if (searchQuery.trim()) {
      const recent = JSON.parse(localStorage.getItem("recentSearches") || "[]");
      const updated = [searchQuery, ...recent.filter((s: string) => s !== searchQuery)].slice(0, 10);
      localStorage.setItem("recentSearches", JSON.stringify(updated));
    }
  };

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
  };

  const handleQuickFilterToggle = (filter: string) => {
    setQuickFilters(prev =>
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-[600px] mx-auto">
        {/* Sticky search header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-20 border-b border-border">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <SearchBar
                  value={query}
                  onChange={setQuery}
                  onSearch={handleSearch}
                />
              </div>
              {query && (
                <SearchFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              )}
            </div>
          </div>

          {query && (
            <>
              <QuickFilters
                activeFilters={quickFilters}
                onToggle={handleQuickFilterToggle}
              />
              <SearchTabs
                activeTab={activeTab}
                onTabChange={handleTabChange}
              />
            </>
          )}
        </div>

        {/* Content */}
        {query ? (
          <SearchResults
            query={query}
            tab={activeTab}
            filters={filters}
            quickFilters={quickFilters}
          />
        ) : (
          <div className="pb-20">
            <CategoryExplorer 
              selectedCategory={selectedCategory}
              onCategorySelect={setSelectedCategory}
            />
            
            {selectedCategory && (
              <div className="mt-6">
                <div className="px-4 mb-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Trending in {selectedCategory}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Post popolari in questa categoria
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {posts
                    .filter(post => post.category === selectedCategory)
                    .slice(0, 10)
                    .map(post => (
                      <FeedCard key={post.id} post={post} />
                    ))}
                  {posts.filter(post => post.category === selectedCategory).length === 0 && (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      <p>Nessun post trovato in questa categoria</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
