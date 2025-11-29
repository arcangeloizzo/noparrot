import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

const CATEGORIES = [
  { name: 'society', emoji: '🏛️', label: 'Società' },
  { name: 'economy', emoji: '💼', label: 'Economia' },
  { name: 'science', emoji: '🔬', label: 'Scienza' },
  { name: 'culture', emoji: '🎨', label: 'Cultura' },
  { name: 'planet', emoji: '🌍', label: 'Pianeta' },
  { name: 'sport', emoji: '⚽', label: 'Sport' },
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
        <div className="grid grid-cols-3 gap-4 p-6 pb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => {
                onSelect(cat.name);
                onOpenChange(false);
              }}
              className={`flex flex-col items-center p-4 rounded-xl bg-[#151F2B] 
                         border transition-all
                         ${selected === cat.name 
                           ? 'border-primary/50 bg-primary/5' 
                           : 'border-white/5 hover:border-white/10'
                         }`}
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
