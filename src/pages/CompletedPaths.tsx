import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { ArticleReader } from "@/components/feed/ArticleReader";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type GateAttempt = {
  id: string;
  created_at: string;
  gate_type: string;
  source_url: string | null;
  score: number;
  passed: boolean;
  post_id: string | null;
  questions?: any;
  post?: {
    id: string;
    content: string;
    category: string | null;
    shared_title: string | null;
    preview_img: string | null;
    article_content: string | null;
  };
};

export default function CompletedPaths() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeNavTab, setActiveNavTab] = useState("profile");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<GateAttempt | null>(null);
  const [showReader, setShowReader] = useState(false);

  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ["completedPaths", user?.id, selectedArea, selectedType, selectedPeriod],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("post_gate_attempts")
        .select(`
          *,
          post:posts(
            id,
            content,
            category,
            shared_title,
            preview_img,
            article_content
          )
        `)
        .eq("user_id", user.id)
        .eq("passed", true)
        .order("created_at", { ascending: false });

      // Filter by type
      if (selectedType !== "all") {
        query = query.eq("gate_type", selectedType);
      }

      // Filter by period
      if (selectedPeriod !== "all") {
        const now = new Date();
        let startDate = new Date();
        
        switch (selectedPeriod) {
          case "today":
            startDate.setHours(0, 0, 0, 0);
            break;
          case "week":
            startDate.setDate(now.getDate() - 7);
            break;
          case "month":
            startDate.setMonth(now.getMonth() - 1);
            break;
        }
        
        query = query.gte("created_at", startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by area (category) in memory since it's in the post relation
      let filteredData = data as GateAttempt[];
      if (selectedArea !== "all") {
        filteredData = filteredData.filter(
          (attempt) => attempt.post?.category === selectedArea
        );
      }

      return filteredData;
    },
    enabled: !!user,
  });

  // Get unique categories for filter
  const categories = Array.from(
    new Set(attempts.map((a) => a.post?.category).filter(Boolean))
  ) as string[];

  const handleItemClick = (attempt: GateAttempt) => {
    setSelectedItem(attempt);
    setShowReader(true);
  };

  const getGateTypeLabel = (type: string) => {
    switch (type) {
      case "composer":
        return "Condivisione";
      case "comment":
        return "Commento";
      case "share":
        return "Condivisione";
      default:
        return type;
    }
  };

  const getDomainFromUrl = (url: string | null) => {
    if (!url) return "";
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "";
    }
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate("/profile")}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Percorsi completati</h1>
            <p className="text-sm text-muted-foreground">
              Accedi ai contenuti che hai elaborato.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto">
          <Select value={selectedArea} onValueChange={setSelectedArea}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tutte le aree" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le aree</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tutti i tipi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tipi</SelectItem>
              <SelectItem value="composer">Condivisione</SelectItem>
              <SelectItem value="comment">Commento</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tutti i periodi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i periodi</SelectItem>
              <SelectItem value="today">Oggi</SelectItem>
              <SelectItem value="week">Ultima settimana</SelectItem>
              <SelectItem value="month">Ultimo mese</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Caricamento...</p>
          </div>
        ) : attempts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-2">
              Nessun percorso completato ancora.
            </p>
            <p className="text-sm text-muted-foreground">
              Inizia a interagire con i contenuti per vedere qui i tuoi progressi.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {attempts.map((attempt) => (
              <button
                key={attempt.id}
                onClick={() => handleItemClick(attempt)}
                className="w-full bg-[#141A1E] border border-white/10 rounded-2xl p-4 text-left hover:bg-[#1A2329] transition-colors"
              >
                {/* Source URL */}
                {attempt.source_url && (
                  <div className="text-xs text-muted-foreground mb-2">
                    📰 {getDomainFromUrl(attempt.source_url)}
                  </div>
                )}

                {/* Title */}
                <h3 className="font-semibold mb-1 line-clamp-2">
                  {attempt.post?.shared_title || "Contenuto senza titolo"}
                </h3>

                {/* Category & Type */}
                <div className="flex items-center gap-2 mb-2">
                  {attempt.post?.category && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      🏷️ {attempt.post.category}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {getGateTypeLabel(attempt.gate_type)}
                  </span>
                </div>

                {/* Date & Status */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    📅{" "}
                    {formatDistanceToNow(new Date(attempt.created_at), {
                      addSuffix: true,
                      locale: it,
                    })}
                  </span>
                  <span className="text-green-500">✅ Percorso completato</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Article Reader */}
      {showReader && selectedItem && selectedItem.post && (
        <ArticleReader
          isOpen={showReader}
          onClose={() => {
            setShowReader(false);
            setSelectedItem(null);
          }}
          post={{
            ...selectedItem.post,
            shared_url: selectedItem.source_url,
            author: { username: '', full_name: '', avatar_url: null },
            created_at: selectedItem.created_at,
            reactions: []
          } as any}
          onStartQuiz={() => {}}
          articleContent={selectedItem.post.article_content || undefined}
        />
      )}

      {/* Bottom Navigation */}
      <BottomNavigation
        activeTab={activeNavTab}
        onTabChange={(tab) => {
          setActiveNavTab(tab);
          if (tab === "home") navigate("/");
          else if (tab === "search") navigate("/search");
          else if (tab === "notifications") navigate("/notifications");
          else if (tab === "messages") navigate("/messages");
        }}
      />
    </div>
  );
}
