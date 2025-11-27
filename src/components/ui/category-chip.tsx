import { cn } from '@/lib/utils';

interface CategoryChipProps {
  category: string;
  className?: string;
}

// Mappa categorie → colori (toni molto desaturati, cognitivi)
const categoryColors: Record<string, { bg: string; text: string }> = {
  'Società & Politica': { bg: 'bg-[#E76A6A]/10', text: 'text-[#E76A6A]' },
  'Economia & Business': { bg: 'bg-[#FFD464]/10', text: 'text-[#FFD464]' },
  'Scienza & Tecnologia': { bg: 'bg-[#2AD2C9]/10', text: 'text-[#2AD2C9]' },
  'Cultura & Arte': { bg: 'bg-[#A98FF8]/10', text: 'text-[#A98FF8]' },
  'Pianeta & Ambiente': { bg: 'bg-[#65D08C]/10', text: 'text-[#65D08C]' },
  'Sport & Lifestyle': { bg: 'bg-[#FFB273]/10', text: 'text-[#FFB273]' },
  'Salute & Benessere': { bg: 'bg-[#F28DB7]/10', text: 'text-[#F28DB7]' },
  'Media & Comunicazione': { bg: 'bg-[#9AA3AB]/10', text: 'text-[#9AA3AB]' },
};

export const CategoryChip = ({ category, className }: CategoryChipProps) => {
  const colors = categoryColors[category] || { bg: 'bg-muted/50', text: 'text-muted-foreground' };

  return (
    <span 
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-normal',
        colors.bg,
        colors.text,
        className
      )}
    >
      {category}
    </span>
  );
};
