import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/config/categories";

interface CategoryExplorerProps {
  selectedCategory: string | null;
  onCategorySelect: (category: string | null) => void;
}

export const CategoryExplorer = ({ selectedCategory, onCategorySelect }: CategoryExplorerProps) => {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 text-foreground">Esplora per Pilastri</h2>
      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map((category) => {
          const isSelected = selectedCategory === category.name;
          
          return (
            <button
              key={category.name}
              onClick={() => onCategorySelect(isSelected ? null : category.name)}
              className={cn(
                "relative overflow-hidden rounded-2xl p-4 transition-all duration-300",
                "flex flex-col items-start justify-between min-h-[120px]",
                "border-2",
                isSelected 
                  ? "shadow-lg scale-105"
                  : "border-border hover:border-border/60 hover:scale-102"
              )}
              style={isSelected ? { borderColor: category.color } : undefined}
            >
              {/* Solid color tint background, derived from canonical palette */}
              <div
                className="absolute inset-0 opacity-10"
                style={{ backgroundColor: category.color }}
              />
              
              {/* Content */}
              <div className="relative z-10 w-full">
                <div className="text-4xl mb-2">{category.emoji}</div>
                <h3 className="font-semibold text-sm leading-tight text-foreground">
                  {category.name}
                </h3>
              </div>
              
              {/* Selection Indicator */}
              {isSelected && (
                <div
                  className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: category.color }}
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
