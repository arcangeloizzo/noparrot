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
  searchType?: "text" | "category";
}

export const SearchResults = ({ query, tab, filters, quickFilters, searchType }: SearchResultsProps) => {
  if (!query) return null;

  return (
    <div className="pb-20">
      {tab === "posts" && <PostsResults query={query} filters={filters} searchType={searchType} />}
      {tab === "people" && <PeopleResults query={query} />}
      {tab === "topics" && <TopicsResults query={query} />}
      {tab === "media" && <MediaResults query={query} />}
      {tab === "sources" && <SourcesResults query={query} />}
    </div>
  );
};
