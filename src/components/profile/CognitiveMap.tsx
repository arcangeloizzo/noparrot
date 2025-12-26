import { CognitiveNebulaCanvas } from './CognitiveNebulaCanvas';

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

      {/* Nebula Canvas 3D */}
      <div className="w-full mb-6">
        <CognitiveNebulaCanvas data={cognitiveDensity} />
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