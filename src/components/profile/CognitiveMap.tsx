import { CognitiveNebulaCanvas } from './CognitiveNebulaCanvas';
import {
  CATEGORY_NAMES as CATEGORIES,
  CATEGORY_COLORS,
  normalizeCategory,
} from '@/config/categories';
import type { CognitiveDensityData } from '@/hooks/useCognitiveDensity';

interface CognitiveMapProps {
  cognitiveDensity: CognitiveDensityData | Record<string, number>;
}

function isStructured(
  d: CognitiveDensityData | Record<string, number> | undefined | null
): d is CognitiveDensityData {
  return !!d && typeof d === 'object' && 'byMacroFlat' in (d as object);
}

export const CognitiveMap = ({ cognitiveDensity }: CognitiveMapProps) => {
  const flatSource: Record<string, number> = isStructured(cognitiveDensity)
    ? cognitiveDensity.byMacroFlat
    : ((cognitiveDensity as Record<string, number>) || {});

  // Normalize legacy keys into the new canonical buckets, then build the
  // ordered list (descending by weight) for the summary.
  const normalizedDensity: Record<string, number> = {};
  Object.entries(flatSource).forEach(([rawKey, value]) => {
    const key = normalizeCategory(rawKey) ?? rawKey;
    if (CATEGORIES.includes(key)) {
      normalizedDensity[key] = (normalizedDensity[key] || 0) + (value || 0);
    }
  });

  const sortedCategories = CATEGORIES
    .map(cat => ({ name: cat, value: normalizedDensity[cat] || 0 }))
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
            {Math.round(Object.values(normalizedDensity).reduce((sum, val) => sum + val, 0))}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Percorsi cognitivi completati
          </div>
        </div>
      </div>
    </div>
  );
};