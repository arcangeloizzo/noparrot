import { cn } from "@/lib/utils";

interface FeedToggleProps {
  activeTab: "following" | "foryou";
  onTabChange: (tab: "following" | "foryou") => void;
}

export const FeedToggle = ({ activeTab, onTabChange }: FeedToggleProps) => {
  return (
    <div className="flex items-center justify-center border-b border-border">
      <button
        onClick={() => onTabChange("following")}
        className={cn(
          "flex-1 px-4 py-3 text-[15px] font-semibold transition-colors relative",
          activeTab === "following" 
            ? "text-foreground" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
        )}
      >
        Following
        {activeTab === "following" && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />
        )}
      </button>
      <button
        onClick={() => onTabChange("foryou")}
        className={cn(
          "flex-1 px-4 py-3 text-[15px] font-semibold transition-colors relative",
          activeTab === "foryou" 
            ? "text-foreground" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
        )}
      >
        For You
        {activeTab === "foryou" && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />
        )}
      </button>
    </div>
  );
};