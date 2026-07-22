import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { ComposerModal } from "@/components/composer/ComposerModal";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchTabs, SearchTab } from "@/components/search/SearchTabs";
import { SearchResults } from "@/components/search/SearchResults";
import { SearchFilters, SearchFiltersState } from "@/components/search/SearchFilters";
import { QuickFilters } from "@/components/search/QuickFilters";
import { useTrendingTopics } from "@/hooks/useTrendingTopics";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Search as SearchIcon } from "lucide-react";
import { Row } from "@/components/shell/Row";
import { TERRITORY_ORDER, TERRITORY_COLORS } from "@/lib/territory";

export const Search = () => {
  const navigate = useNavigate();
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
  const [isComposerOpen, setIsComposerOpen] = useState(false);

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

  // Territori inesplorati = quelli senza topic nella risposta trending
  const exploredTerritories = useMemo(() => {
    const set = new Set<string>();
    trendingData?.topics?.forEach((t) => {
      if (t.badge_category) set.add(t.badge_category);
    });
    return set;
  }, [trendingData]);

  const unexplored = useMemo(
    () => TERRITORY_ORDER.filter((t) => !exploredTerritories.has(t)),
    [exploredTerritories]
  );

  return (
    <div className="shell-page">
      <header className="shell-header">
        <h1 className="shell-title">Cerca</h1>
        <div style={{ marginTop: 14 }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
          />
        </div>
      </header>

      {!hasActiveQuery ? (
        <div className="pb-6">
          {/* Rail territori */}
          <div style={{ padding: "6px 0 4px" }}>
            <div className="mono-eyebrow" style={{ padding: "0 var(--pad) 10px" }}>
              Territori
            </div>
            <div className="filter-rail">
              {TERRITORY_ORDER.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="pill-filter"
                  onClick={() => handleTopicClick(t, t)}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: TERRITORY_COLORS[t],
                      display: "inline-block",
                    }}
                  />
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Sezione Trend */}
          <div style={{ marginTop: 22 }}>
            <div
              className="flex items-center gap-3"
              style={{ padding: "0 var(--pad) 12px" }}
            >
              <span className="mono-eyebrow">Trend · Ultimi 7 giorni</span>
              <span className="hairline" />
            </div>

            <div className="flex flex-col">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="row" style={{ pointerEvents: "none" }}>
                    <Skeleton style={{ width: 28, height: 28, borderRadius: 8 }} />
                    <div className="flex-1 space-y-2 py-1">
                      <Skeleton className="h-4 w-3/4 rounded" />
                      <Skeleton className="h-3 w-1/2 rounded" />
                    </div>
                  </div>
                ))
              ) : trendingData?.mode === "TRENDING" &&
                trendingData.topics &&
                trendingData.topics.length > 0 ? (
                trendingData.topics.map((topic, i) => {
                  const rib = TERRITORY_COLORS[topic.badge_category as keyof typeof TERRITORY_COLORS];
                  const totalComprehensions = topic.stats.posts + topic.stats.comments;
                  // sparkline placeholder — 5 barrette variabili in base al conteggio
                  const bars = [0.6, 1, 0.8, 0.5, 0.9];
                  return (
                    <Row
                      key={topic.topic_id}
                      as="button"
                      ribColor={rib}
                      onClick={() => handleTopicClick(topic.topic_id, topic.title)}
                    >
                      <div
                        className="flex-shrink-0 flex items-center justify-center"
                        style={{
                          width: 34,
                          fontFamily: "var(--display)",
                          fontSize: 22,
                          lineHeight: 1,
                          color: "var(--txt-2)",
                          textTransform: "uppercase",
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                        <div className="row-title line-clamp-1">{topic.title}</div>
                        <div className="mono-meta">
                          {totalComprehensions} comprensioni · {topic.badge_category ?? "—"}
                        </div>
                      </div>
                      {/* Sparkline */}
                      <div
                        className="flex items-end gap-0.5 flex-shrink-0"
                        style={{ height: 18 }}
                      >
                        {bars.map((h, k) => (
                          <span
                            key={k}
                            style={{
                              width: 3,
                              height: `${h * 18}px`,
                              background: rib || "rgba(255,255,255,0.4)",
                              borderRadius: 1,
                              opacity: 0.7,
                            }}
                          />
                        ))}
                      </div>
                    </Row>
                  );
                })
              ) : (
                <div
                  className="text-center py-8 mx-[var(--pad)]"
                  style={{
                    background: "rgba(255,255,255,0.035)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 18,
                  }}
                >
                  <Sparkles
                    className="w-6 h-6 mx-auto mb-2"
                    style={{ color: "var(--txt-3)" }}
                  />
                  <p style={{ color: "var(--txt-2)", fontSize: 14 }}>
                    La community sta iniziando a muoversi
                  </p>
                  <p style={{ color: "var(--txt-3)", fontSize: 12.5, marginTop: 4 }}>
                    Torna più tardi per scoprire le discussioni più attive
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Territori inesplorati */}
          {unexplored.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div
                className="flex items-center gap-3"
                style={{ padding: "0 var(--pad) 12px" }}
              >
                <span className="mono-eyebrow">Inesplorati · 0 comprensioni</span>
                <span className="hairline" />
              </div>

              <div className="dashed-block">
                <div className="flex flex-wrap gap-2">
                  {unexplored.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTopicClick(t, t)}
                      className="inline-flex items-center gap-2 rounded-full transition-colors"
                      style={{
                        padding: "8px 14px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        fontFamily: "var(--mono)",
                        fontSize: 10.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--txt-2)",
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: TERRITORY_COLORS[t],
                          opacity: 0.9,
                        }}
                      />
                      {t}
                    </button>
                  ))}
                </div>
                <p
                  style={{
                    color: "var(--txt-3)",
                    fontSize: 12.5,
                    marginTop: 14,
                    lineHeight: 1.5,
                  }}
                >
                  Pianeti ancora tutti da scoprire. Esplora un territorio per iniziare
                  ad accendere la tua Nebulosa.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <SearchTabs activeTab={activeTab} onTabChange={handleTabChange} />
          <div className="px-4 space-y-3">
            <QuickFilters
              activeFilters={quickFilters}
              onToggle={handleQuickFilterToggle}
            />
            <SearchFilters filters={filters} onFiltersChange={setFilters} />
          </div>
          <SearchResults
            query={searchQuery}
            tab={activeTab}
            filters={filters}
            quickFilters={quickFilters}
            searchType={typeParam || undefined}
          />
        </div>
      )}

      <BottomNavigation 
        activeTab="search"
        onTabChange={(tab) => {
          if (tab === 'home') navigate('/');
          else if (tab === 'messages') navigate('/messages');
        }}
        onComposerClick={() => setIsComposerOpen(true)}
      />

      {/* Composer Modal */}
      <ComposerModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
      />
    </div>
  );
};
