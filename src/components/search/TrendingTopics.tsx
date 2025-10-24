import { TrendingUp, Hash } from "lucide-react";

interface TrendingTopicsProps {
  onSelect: (query: string) => void;
}

const TRENDING = [
  { topic: "Intelligenza Artificiale", posts: 1234, trending: true },
  { topic: "Elezioni 2024", posts: 892, trending: true },
  { topic: "Cambiamento Climatico", posts: 567, trending: false },
  { topic: "Tecnologia", posts: 445, trending: false },
  { topic: "Salute", posts: 332, trending: false },
  { topic: "Sport", posts: 298, trending: false },
  { topic: "Economia", posts: 245, trending: false },
  { topic: "Cultura", posts: 189, trending: false },
];

export const TrendingTopics = ({ onSelect }: TrendingTopicsProps) => {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Tendenze per te</h3>
      </div>

      <div className="space-y-2">
        {TRENDING.map((trend, i) => (
          <button
            key={i}
            onClick={() => onSelect(`#${trend.topic}`)}
            className="w-full flex items-start gap-3 p-3 hover:bg-muted rounded-lg transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              {trend.trending ? (
                <TrendingUp className="w-5 h-5 text-primary" />
              ) : (
                <Hash className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold group-hover:text-primary transition-colors truncate">
                {trend.topic}
              </div>
              <div className="text-sm text-muted-foreground">
                {trend.posts.toLocaleString()} post
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
