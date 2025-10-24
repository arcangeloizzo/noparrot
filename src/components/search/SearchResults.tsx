import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./EmptyState";
import { SearchTab } from "./SearchTabs";
import { PostsResults } from "./results/PostsResults";
import { PeopleResults } from "./results/PeopleResults";
import { TopicsResults } from "./results/TopicsResults";
import { MediaResults } from "./results/MediaResults";
import { SourcesResults } from "./results/SourcesResults";
import type { SearchFiltersState } from "./SearchFilters";

interface SearchResultsProps {
  query: string;
  tab: SearchTab;
  filters: SearchFiltersState;
  quickFilters: string[];
}

export const SearchResults = ({ query, tab, filters, quickFilters }: SearchResultsProps) => {
  const observerTarget = useRef<HTMLDivElement>(null);

  // This will be replaced with real API calls
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["search", query, tab, filters, quickFilters],
    queryFn: async ({ pageParam = 0 }) => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        items: [],
        nextPage: pageParam + 1,
        hasMore: false,
      };
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPage : undefined,
    initialPageParam: 0,
    enabled: !!query,
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const current = observerTarget.current;
    if (current) {
      observer.observe(current);
    }

    return () => {
      if (current) {
        observer.unobserve(current);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const allItems = data?.pages.flatMap(page => page.items) || [];

  if (allItems.length === 0 && query) {
    return <EmptyState query={query} />;
  }

  return (
    <div className="pb-20">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {allItems.length} risultati trovati
      </div>

      {tab === "posts" && <PostsResults query={query} filters={filters} />}
      {tab === "people" && <PeopleResults query={query} />}
      {tab === "topics" && <TopicsResults query={query} />}
      {tab === "media" && <MediaResults query={query} />}
      {tab === "sources" && <SourcesResults query={query} />}

      {/* Infinite scroll trigger */}
      <div ref={observerTarget} className="h-10 flex items-center justify-center">
        {isFetchingNextPage && (
          <div className="space-y-3 w-full px-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
      </div>
    </div>
  );
};
