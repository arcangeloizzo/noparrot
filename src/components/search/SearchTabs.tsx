import { cn } from "@/lib/utils";

export type SearchTab = "posts" | "people" | "topics" | "media" | "sources";

interface SearchTabsProps {
  activeTab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
}

const tabs: { id: SearchTab; label: string }[] = [
  { id: "posts", label: "Post" },
  { id: "people", label: "Persone" },
  { id: "topics", label: "Argomenti" },
  { id: "media", label: "Media" },
  { id: "sources", label: "Fonti" },
];

export const SearchTabs = ({ activeTab, onTabChange }: SearchTabsProps) => {
  return (
    <div className="flex border-b border-border" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex-1 py-3 px-4 text-sm font-medium transition-colors relative",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            activeTab === tab.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      ))}
    </div>
  );
};
