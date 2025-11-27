import { Trophy, TrendingUp, Circle } from "lucide-react";

interface CognitiveIdentityProps {
  cognitiveDensity: Record<string, number>;
}

const CATEGORIES = [
  'Società & Politica',
  'Economia & Business',
  'Scienza & Tecnologia',
  'Cultura & Arte',
  'Pianeta & Ambiente',
  'Sport & Lifestyle',
  'Salute & Benessere',
  'Media & Comunicazione',
];

const CATEGORY_COLORS: Record<string, string> = {
  'Società & Politica': '#E76A6A',
  'Economia & Business': '#FFD464',
  'Scienza & Tecnologia': '#2AD2C9',
  'Cultura & Arte': '#A98FF8',
  'Pianeta & Ambiente': '#65D08C',
  'Sport & Lifestyle': '#FFB273',
  'Salute & Benessere': '#F28DB7',
  'Media & Comunicazione': '#9AA3AB',
};

export const CognitiveIdentity = ({ cognitiveDensity = {} }: CognitiveIdentityProps) => {
  // Calcola i temi
  const sortedCategories = CATEGORIES
    .map(cat => ({ name: cat, value: cognitiveDensity[cat] || 0 }))
    .sort((a, b) => b.value - a.value);

  const temaPredominante = sortedCategories[0];
  const temaEmergente = sortedCategories.find(cat => cat.value > 0 && cat.name !== temaPredominante.name) || sortedCategories[1];
  const spazioSilenzioso = sortedCategories.find(cat => cat.value === 0) || sortedCategories[sortedCategories.length - 1];

  const cards = [
    {
      icon: Trophy,
      title: "Tema predominante",
      category: temaPredominante.name,
      color: CATEGORY_COLORS[temaPredominante.name],
      description: "Il tuo punto di forza",
      value: temaPredominante.value,
    },
    {
      icon: TrendingUp,
      title: "Tema emergente",
      category: temaEmergente.name,
      color: CATEGORY_COLORS[temaEmergente.name],
      description: "Stai esplorando nuove connessioni",
      value: temaEmergente.value,
    },
    {
      icon: Circle,
      title: "Spazio silenzioso",
      category: spazioSilenzioso.name,
      color: CATEGORY_COLORS[spazioSilenzioso.name],
      description: "Un ambito ancora da scoprire",
      value: spazioSilenzioso.value,
    },
  ];

  return (
    <div className="w-full">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Identità Cognitiva</h3>
        <p className="text-sm text-muted-foreground">
          Ciò che capisci ti plasma. Ecco cosa stai coltivando.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="p-5 bg-[#141A1E] rounded-xl border border-[#2AD2C9]/20 hover:border-[#2AD2C9]/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-3">
              <card.icon className="w-5 h-5" style={{ color: card.color }} />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {card.title}
              </span>
            </div>
            
            <div className="mb-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: card.color }}
                />
                <span className="text-base font-semibold text-foreground">
                  {card.category}
                </span>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground italic">
              {card.description}
            </p>
            
            {card.value > 0 && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <span className="text-xs text-muted-foreground">
                  {card.value} percors{card.value === 1 ? 'o' : 'i'}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
