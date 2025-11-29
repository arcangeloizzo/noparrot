import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Header } from "@/components/navigation/Header";
import { SearchBar } from "@/components/search/SearchBar";
import { InsightCard } from "@/components/search/InsightCard";
import { CategoryFilterDrawer } from "@/components/search/CategoryFilterDrawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const MOCK_INSIGHTS = [
  {
    label: "🌍 MONDO",
    labelColor: "bg-blue-500/20 text-blue-400",
    title: "Elezioni USA, i risultati definitivi",
    summary: "I risultati finali delle elezioni presidenziali americane sono stati certificati. L'analisi delle tendenze di voto mostra significativi cambiamenti demografici rispetto al 2020, con particolare attenzione ai giovani elettori.",
    sources: [
      { icon: "📰", name: "NYT" },
      { icon: "📄", name: "Repubblica" },
      { icon: "📋", name: "Guardian" }
    ],
    sourceCount: 3,
    trustScore: "Alto" as const
  },
  {
    label: "🦜 COMMUNITY",
    labelColor: "bg-[#2AD2C9]/20 text-[#2AD2C9]",
    title: "Il dibattito sull'AI Act nel feed",
    summary: "La community NoParrot sta discutendo le implicazioni dell'AI Act europeo. I temi più dibattuti riguardano la trasparenza algoritmica, i diritti dei creatori e l'impatto sulle piccole startup tecnologiche.",
    sources: [
      { icon: "🦜", name: "NoParrot" },
      { icon: "💬", name: "Community" },
      { icon: "🗨️", name: "Forum" }
    ],
    sourceCount: 12,
    trustScore: "Alto" as const
  },
  {
    label: "🧠 PER TE: SCIENZA",
    labelColor: "bg-purple-500/20 text-purple-400",
    title: "Nuova scoperta sui semiconduttori",
    summary: "Ricercatori del MIT hanno sviluppato un nuovo materiale semiconduttore che promette di rivoluzionare l'efficienza energetica dei chip di nuova generazione. La scoperta potrebbe ridurre il consumo energetico del 40%.",
    sources: [
      { icon: "🔬", name: "MIT" },
      { icon: "📊", name: "Nature" },
      { icon: "🧪", name: "Science" }
    ],
    sourceCount: 5,
    trustScore: "Medio" as const
  },
  {
    label: "🧠 PER TE: ECONOMIA",
    labelColor: "bg-amber-500/20 text-amber-400",
    title: "Tassi BCE invariati",
    summary: "La Banca Centrale Europea ha mantenuto i tassi di interesse invariati, segnalando un approccio cauto all'inflazione. Gli analisti prevedono possibili tagli nel primo trimestre 2025 se i dati macro confermeranno il trend.",
    sources: [
      { icon: "💶", name: "BCE" },
      { icon: "📈", name: "Bloomberg" },
      { icon: "💼", name: "FT" }
    ],
    sourceCount: 4,
    trustScore: "Alto" as const
  }
];

const CATEGORY_LABELS: Record<string, string> = {
  society: '🏛️ Società',
  economy: '💼 Economia',
  science: '🔬 Scienza',
  culture: '🎨 Cultura',
  planet: '🌍 Pianeta',
  sport: '⚽ Sport'
};

export const Search = () => {
  const [query, setQuery] = useState("");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    
    if (searchQuery.trim()) {
      const recent = JSON.parse(localStorage.getItem("recentSearches") || "[]");
      const updated = [searchQuery, ...recent.filter((s: string) => s !== searchQuery)].slice(0, 10);
      localStorage.setItem("recentSearches", JSON.stringify(updated));
    }
  };

  // Filtra insights per categoria selezionata (mock)
  const filteredInsights = selectedCategory 
    ? MOCK_INSIGHTS.filter((_, idx) => idx % 2 === 0) // Mock: mostra solo alcune card
    : MOCK_INSIGHTS;

  return (
    <div className="min-h-screen bg-[#0E141A]">
      <Header />
      <div className="max-w-[600px] mx-auto">
        
        {/* Sticky Header */}
        <div className="sticky top-0 bg-[#0E141A]/95 backdrop-blur-sm z-20 border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-[0.85]">
              <SearchBar
                value={query}
                onChange={setQuery}
                onSearch={handleSearch}
              />
            </div>
            <Button 
              variant="outline" 
              size="icon"
              className="h-12 w-12 rounded-xl bg-[#151F2B] border-white/10 hover:bg-[#1a2533] hover:border-primary/50 shrink-0"
              onClick={() => setFilterDrawerOpen(true)}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Active filter chip */}
          {selectedCategory && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-[#9AA3AB]">Filtro attivo:</span>
              <Badge 
                variant="outline" 
                className="bg-primary/10 text-primary border-primary/20 pl-3 pr-1.5 py-1 gap-1.5"
              >
                {CATEGORY_LABELS[selectedCategory]}
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="hover:bg-primary/20 rounded-sm p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            </div>
          )}
        </div>

        {/* Daily Briefing Feed */}
        <div className="p-4 space-y-6 pb-24">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground">Daily Briefing</h2>
            <p className="text-sm text-[#9AA3AB]">Le notizie che contano, sintetizzate per te</p>
          </div>
          
          <div className="space-y-6">
            {filteredInsights.map((insight, idx) => (
              <InsightCard 
                key={idx} 
                {...insight}
                onAction={() => console.log('Approfondisci:', insight.title)}
              />
            ))}
          </div>

          {filteredInsights.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[#9AA3AB] text-sm">
                Nessun insight disponibile per questa categoria
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Category Filter Drawer */}
      <CategoryFilterDrawer 
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />
    </div>
  );
};
