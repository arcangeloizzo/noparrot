import { cn } from "@/lib/utils";

interface FeedToggleProps {
  activeTab: "following" | "foryou";
  onTabChange: (tab: "following" | "foryou") => void;
}

export const FeedToggle = ({ activeTab, onTabChange }: FeedToggleProps) => {
  return (
    <div className="flex items-center justify-center p-1 bg-muted rounded-full w-fit mx-auto">
      <button
        onClick={() => onTabChange("following")}
        className={cn(
          "px-6 py-2 text-sm font-medium rounded-full transition-all duration-200",
          activeTab === "following" 
            ? "bg-primary-blue text-white" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Following
      </button>
      <button
        onClick={() => onTabChange("foryou")}
        className={cn(
          "px-6 py-2 text-sm font-medium rounded-full transition-all duration-200",
          activeTab === "foryou" 
            ? "bg-primary-blue text-white" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        For You
      </button>
    </div>
  );
};