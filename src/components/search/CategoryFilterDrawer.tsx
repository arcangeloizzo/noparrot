import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { CATEGORIES } from "@/config/categories";

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
                {cat.shortName}
              </span>
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
