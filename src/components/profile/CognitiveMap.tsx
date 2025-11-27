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

  return (
    <div className="w-full">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Nebulosa Cognitiva</h3>
        <p className="text-sm text-muted-foreground">
          Mappa dei tuoi percorsi cognitivi completati per area tematica
        </p>
      </div>

      {/* Radar Chart */}
      <div className="w-full h-[400px] mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis 
              dataKey="category" 
              tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, maxValue]}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            />
            <Radar
              name="Densità"
              dataKey="value"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend con dettaglio numerico */}
      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map(category => (
          <div key={category} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[category] }}
              />
              <span className="text-xs text-muted-foreground">{category}</span>
            </div>
            <span className="text-xs font-semibold">
              {cognitiveDensity[category] || 0}
            </span>
          </div>
        ))}
      </div>

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
