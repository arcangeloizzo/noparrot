import { cn } from '@/lib/utils';
import { normalizeCategory, CATEGORY_COLORS } from '@/config/categories';

interface CategoryChipProps {
  category: string;
  className?: string;
}

export const CategoryChip = ({ category, className }: CategoryChipProps) => {
  // Normalize legacy labels (e.g. "Salute & Benessere" → "Benessere") so historical
  // posts adopt the new palette automatically. Display the normalized name.
  const normalized = normalizeCategory(category);
  const displayName = normalized ?? category;
  const color = normalized ? CATEGORY_COLORS[normalized] : null;

  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-normal',
        !color && 'bg-muted/50 text-muted-foreground',
        className
      )}
      style={color ? { backgroundColor: `${color}1A`, color } : undefined}
    >
      {displayName}
    </span>
  );
};
