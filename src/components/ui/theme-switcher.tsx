import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { useEffect, useState } from "react";

const options = [
  { value: 'dark', icon: Moon, label: 'Scuro' },
  { value: 'light', icon: Sun, label: 'Chiaro' },
  { value: 'system', icon: Monitor, label: 'Sistema' },
] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = (value: string) => {
    haptics.light();
    setTheme(value);
  };

  if (!mounted) {
    return (
      <div className="flex gap-2">
        {options.map(({ value, icon: Icon, label }) => (
          <div
            key={value}
            className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border bg-muted/20 border-border/50"
          >
            <Icon className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {options.map(({ value, icon: Icon, label }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            onClick={() => handleChange(value)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 border",
              isActive 
                ? "bg-primary/10 border-primary/50 text-primary" 
                : "bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/40 hover:border-border"
            )}
          >
            <Icon className={cn("w-5 h-5", isActive && "text-primary")} />
            <span className="text-xs font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
