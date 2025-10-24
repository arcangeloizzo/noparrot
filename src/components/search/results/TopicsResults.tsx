import { Hash, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

interface TopicsResultsProps {
  query: string;
}

const MOCK_TOPICS = [
  { tag: "Politica", count: 1234 },
  { tag: "Tecnologia", count: 892 },
  { tag: "Scienza", count: 567 },
  { tag: "Sport", count: 445 },
  { tag: "Economia", count: 332 },
  { tag: "Salute", count: 289 },
  { tag: "Ambiente", count: 201 },
  { tag: "Cultura", count: 178 },
];

export const TopicsResults = ({ query }: TopicsResultsProps) => {
  const filteredTopics = query
    ? MOCK_TOPICS.filter(t => t.tag.toLowerCase().includes(query.toLowerCase()))
    : MOCK_TOPICS;

  if (filteredTopics.length === 0) {
    return null;
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-3">
        {filteredTopics.map((topic) => (
          <Link
            key={topic.tag}
            to={`/search?q=${encodeURIComponent(`#${topic.tag}`)}&tab=posts`}
            className="flex items-start gap-3 p-4 bg-muted rounded-xl hover:bg-muted/80 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              {topic.count > 500 ? (
                <TrendingUp className="w-5 h-5 text-primary" />
              ) : (
                <Hash className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">#{topic.tag}</div>
              <div className="text-xs text-muted-foreground">
                {topic.count.toLocaleString()} post
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
