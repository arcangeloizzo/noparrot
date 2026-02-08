import { useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";

export interface SearchFiltersState {
  dateRange: "today" | "7days" | "30days" | "custom";
  language: "auto" | "it" | "en";
  contentType: string[];
  trustScore: "all" | "high" | "medium";
  sortBy: "relevance" | "recent" | "top";
}

interface SearchFiltersProps {
  filters: SearchFiltersState;
  onFiltersChange: (filters: SearchFiltersState) => void;
}

const defaultFilters: SearchFiltersState = {
  dateRange: "30days",
  language: "auto",
  contentType: [],
  trustScore: "all",
  sortBy: "relevance",
};

export const SearchFilters = ({ filters, onFiltersChange }: SearchFiltersProps) => {
  const [localFilters, setLocalFilters] = useState(filters);
  const [open, setOpen] = useState(false);

  const handleApply = () => {
    onFiltersChange(localFilters);
    setOpen(false);
  };

  const handleReset = () => {
    setLocalFilters(defaultFilters);
  };

  const toggleContentType = (type: string) => {
    setLocalFilters(prev => ({
      ...prev,
      contentType: prev.contentType.includes(type)
        ? prev.contentType.filter(t => t !== type)
        : [...prev.contentType, type]
    }));
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Filtri avanzati"
        >
          <Filter className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtri avanzati</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Intervallo date */}
          <div className="space-y-3">
            <Label>Intervallo date</Label>
            <RadioGroup
              value={localFilters.dateRange}
              onValueChange={(value: any) => setLocalFilters({ ...localFilters, dateRange: value })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="today" id="today" />
                <Label htmlFor="today" className="font-normal">Oggi</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="7days" id="7days" />
                <Label htmlFor="7days" className="font-normal">Ultima settimana</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="30days" id="30days" />
                <Label htmlFor="30days" className="font-normal">Ultimi 30 giorni</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Lingua */}
          <div className="space-y-3">
            <Label>Lingua</Label>
            <RadioGroup
              value={localFilters.language}
              onValueChange={(value: any) => setLocalFilters({ ...localFilters, language: value })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="auto" id="auto" />
                <Label htmlFor="auto" className="font-normal">Automatico</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="it" id="it" />
                <Label htmlFor="it" className="font-normal">Italiano</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="en" id="en" />
                <Label htmlFor="en" className="font-normal">Inglese</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Tipo contenuto */}
          <div className="space-y-3">
            <Label>Tipo contenuto</Label>
            <div className="space-y-2">
              {["text", "link", "image", "video"].map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={type}
                    checked={localFilters.contentType.includes(type)}
                    onCheckedChange={() => toggleContentType(type)}
                  />
                  <Label htmlFor={type} className="font-normal capitalize">
                    {type === "text" ? "Testo" : type === "link" ? "Link" : 
                     type === "image" ? "Immagini" : "Video"}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Trust Score */}
          <div className="space-y-3">
            <Label>Trust Score</Label>
            <RadioGroup
              value={localFilters.trustScore}
              onValueChange={(value: any) => setLocalFilters({ ...localFilters, trustScore: value })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="font-normal">Tutti</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="high" />
                <Label htmlFor="high" className="font-normal">Alto</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="medium" />
                <Label htmlFor="medium" className="font-normal">Medio</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Ordina per */}
          <div className="space-y-3">
            <Label>Ordina per</Label>
            <RadioGroup
              value={localFilters.sortBy}
              onValueChange={(value: any) => setLocalFilters({ ...localFilters, sortBy: value })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="relevance" id="relevance" />
                <Label htmlFor="relevance" className="font-normal">Pertinenza</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="recent" id="recent" />
                <Label htmlFor="recent" className="font-normal">Recenti</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="top" id="top" />
                <Label htmlFor="top" className="font-normal">Top</Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 sticky bottom-0 bg-background pt-4 pb-2 border-t">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            Resetta
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Applica
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
