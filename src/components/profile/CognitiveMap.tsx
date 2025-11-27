import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface CognitiveMapProps {
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

export const CognitiveMap = ({ cognitiveDensity = {} }: CognitiveMapProps) => {
  // Prepara i dati per il radar chart
  const data = CATEGORIES.map(category => ({
    category: category.split(' & ')[0], // Prima parola per brevità
    value: cognitiveDensity[category] || 0,
    fullCategory: category
  }));

  const maxValue = Math.max(...data.map(d => d.value), 10); // Almeno 10 come max

  // Lista ordinata per densità
  const sortedCategories = CATEGORIES
    .map(cat => ({ name: cat, value: cognitiveDensity[cat] || 0 }))
    .filter(cat => cat.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="w-full" id="nebulosa">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Nebulosa Cognitiva</h3>
        <p className="text-sm text-muted-foreground">
          La mappa dei tuoi percorsi di comprensione, tema dopo tema.
        </p>
      </div>

      {/* Radar Chart - più morbido */}
      <div className="w-full h-[400px] mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="hsl(var(--border))" strokeWidth={0.5} />
            <PolarAngleAxis 
              dataKey="category" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, maxValue]}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
            />
            <Radar
              name="Densità"
              dataKey="value"
              stroke="#BFE9E9"
              fill="#BFE9E9"
              fillOpacity={0.15}
              strokeWidth={1}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Lista riepilogativa ordinata */}
      {sortedCategories.length > 0 && (
        <div className="mb-6 space-y-2">
          {sortedCategories.map(cat => (
            <div key={cat.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[cat.name] }}
                />
                <span className="text-sm text-muted-foreground font-normal">
                  {cat.name}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                {cat.value} Percors{cat.value === 1 ? 'o' : 'i'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Totale percorsi */}
      <div className="mt-6 p-4 bg-muted/30 rounded-xl">
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">
            {Object.values(cognitiveDensity).reduce((sum, val) => sum + val, 0)}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Percorsi cognitivi completati
          </div>
        </div>
      </div>
    </div>
  );
};
