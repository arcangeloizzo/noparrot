import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

const CATEGORIES = [
  { name: 'society', emoji: '🏛️', label: 'Società', color: '#E76A6A' },
  { name: 'economy', emoji: '💼', label: 'Economia', color: '#FFD464' },
  { name: 'science', emoji: '🔬', label: 'Scienza', color: '#2AD2C9' },
  { name: 'culture', emoji: '🎨', label: 'Cultura', color: '#A98FF8' },
  { name: 'planet', emoji: '🌍', label: 'Pianeta', color: '#65D08C' },
  { name: 'sport', emoji: '⚽', label: 'Sport', color: '#FFB273' },
  { name: 'health', emoji: '💊', label: 'Salute', color: '#F28DB7' },
  { name: 'media', emoji: '📡', label: 'Media', color: '#9AA3AB' },
];

interface CategoryFilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: string | null;
  onSelect: (category: string) => void;
}

export const CategoryFilterDrawer = ({
  open,
  onOpenChange,
  selected,
  onSelect
}: CategoryFilterDrawerProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-[#0E141A]/95 backdrop-blur-xl border-white/5">
        <DrawerHeader>
          <DrawerTitle className="text-foreground">Filtra per Pilastro</DrawerTitle>
        </DrawerHeader>
        <div className="grid grid-cols-4 gap-3 p-6 pb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => {
                onSelect(cat.name);
                onOpenChange(false);
              }}
              className={`flex flex-col items-center p-4 rounded-xl bg-[#151F2B] 
                         border-2 transition-all
                         ${selected === cat.name 
                           ? `bg-opacity-20` 
                           : 'border-white/5 hover:border-white/10'
                         }`}
              style={selected === cat.name ? { borderColor: cat.color, backgroundColor: `${cat.color}15` } : {}}
            >
              <span className="text-3xl mb-2">{cat.emoji}</span>
              <span className="text-xs text-center text-[#D1D5DB] font-medium">
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
