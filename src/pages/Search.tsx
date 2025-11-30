import { useState } from "react";
import { Header } from "@/components/navigation/Header";
import { SearchBar } from "@/components/search/SearchBar";
import { TrendingTopicCard } from "@/components/search/TrendingTopicCard";
import { useToast } from "@/hooks/use-toast";

// Mock Data per Trending Topics (discussioni community interne)
const MOCK_TRENDING_TOPICS = [
  {
    id: '1',
    title: 'Il caso Ferragni',
    summary: 'La community discute sulla strategia comunicativa di Chiara Ferragni post-pandoro. I temi più dibattuti riguardano la trasparenza degli influencer e le responsabilità verso i follower.',
    postCount: 450
  },
  {
    id: '2',
    title: "L'AI Act europeo",
    summary: "La community NoParrot sta discutendo le implicazioni dell'AI Act europeo. I temi più dibattuti riguardano la trasparenza algoritmica, i diritti dei creatori e l'impatto sulle piccole startup tecnologiche.",
    postCount: 328
  },
  {
    id: '3',
    title: 'Crisi climatica e greenwashing',
    summary: "Discussione accesa sulle pratiche di greenwashing delle grandi aziende. Gli utenti condividono casi di studio e analizzano le strategie di comunicazione ambientale.",
    postCount: 267
  },
  {
    id: '4',
    title: 'Il futuro del lavoro remoto',
    summary: "La community dibatte sulle nuove politiche aziendali post-pandemia. Tra i temi: produttività, work-life balance e l'impatto sul mercato immobiliare.",
    postCount: 189
  },
  {
    id: '5',
    title: 'Salute mentale e social media',
    summary: "Discussione approfondita sull'impatto dei social media sulla salute mentale dei giovani. Gli utenti condividono ricerche e esperienze personali.",
    postCount: 156
  },
  {
    id: '6',
    title: 'Geopolitica: tensioni nel Mar Cinese',
    summary: "Analisi approfondita delle tensioni geopolitiche nella regione. La community discute le implicazioni per l'economia globale e la sicurezza internazionale.",
    postCount: 134
  },
  {
    id: '7',
    title: 'NFT e proprietà digitale',
    summary: "Dibattito sul futuro degli NFT oltre l'arte. Gli utenti esplorano applicazioni in ambito gaming, ticketing e certificazione.",
    postCount: 112
  },
  {
    id: '8',
    title: 'Medicina personalizzata e AI',
    summary: "La community medica discute l'integrazione dell'intelligenza artificiale nella diagnosi personalizzata. Focus su etica e privacy dei dati sanitari.",
    postCount: 98
  }
];

export const Search = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const handleSearch = (query: string) => {
    console.log("Searching for:", query);
    
    const recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    if (query && !recentSearches.includes(query)) {
      const updated = [query, ...recentSearches].slice(0, 5);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
    }
  };

  const handleTopicClick = (topic: typeof MOCK_TRENDING_TOPICS[0]) => {
    toast({
      title: "Navigazione ai post",
      description: `Apertura lista post filtrati per: ${topic.title}`
    });
  };

  return (
    <div className="min-h-screen bg-[#0E141A] pb-20">
      <Header />
      
      <div className="mobile-container max-w-[600px] mx-auto">
        {/* Sticky Search Bar */}
        <div className="sticky top-0 bg-[#0E141A]/95 backdrop-blur-sm z-20 p-4">
          <SearchBar 
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
          />
        </div>

        {/* Trending Topics - Polso Interno della Community */}
        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🔥</span>
              <span>Di cosa parla la community</span>
            </h2>
            <p className="text-sm text-gray-400">
              Le discussioni più attive del momento
            </p>
          </div>
          
          <div className="space-y-3">
            {MOCK_TRENDING_TOPICS.map((topic) => (
              <TrendingTopicCard
                key={topic.id}
                title={topic.title}
                summary={topic.summary}
                postCount={topic.postCount}
                onClick={() => handleTopicClick(topic)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
