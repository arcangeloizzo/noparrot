import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PollData {
  options: string[];
  durationPreset: '1h' | '6h' | '12h' | '24h' | '3d' | '7d' | null;
}

interface PollCreatorProps {
  pollData: PollData;
  onChange: (data: PollData) => void;
  onRemove: () => void;
  disabled?: boolean;
}

const DURATION_PRESETS: { value: PollData['durationPreset']; label: string }[] = [
  { value: '1h', label: '1 ora' },
  { value: '6h', label: '6 ore' },
  { value: '12h', label: '12 ore' },
  { value: '24h', label: '24 ore' },
  { value: '3d', label: '3 giorni' },
  { value: '7d', label: '7 giorni' },
];

export const PollCreator = ({ pollData, onChange, onRemove, disabled }: PollCreatorProps) => {
  const updateOption = (index: number, value: string) => {
    const newOptions = [...pollData.options];
    newOptions[index] = value;
    onChange({ ...pollData, options: newOptions });
  };

  const addOption = () => {
    if (pollData.options.length >= 8) return;
    onChange({ ...pollData, options: [...pollData.options, ''] });
  };

  const removeOption = (index: number) => {
    if (pollData.options.length <= 2) return;
    const newOptions = pollData.options.filter((_, i) => i !== index);
    onChange({ ...pollData, options: newOptions });
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Sondaggio</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full"
          onClick={onRemove}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {pollData.options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0 flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground font-medium">{idx + 1}</span>
            </div>
            <Input
              value={opt}
              onChange={(e) => updateOption(idx, e.target.value)}
              placeholder={`Opzione ${idx + 1}`}
              className="h-9 text-sm bg-background/80"
              maxLength={200}
              disabled={disabled}
            />
            {pollData.options.length > 2 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full flex-shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeOption(idx)}
                disabled={disabled}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Add option */}
      {pollData.options.length < 8 && (
        <button
          type="button"
          onClick={addOption}
          disabled={disabled}
          className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80 transition-colors pl-7"
        >
          <Plus className="h-4 w-4" />
          Aggiungi opzione
        </button>
      )}

      {/* Duration selector */}
      <div className="pt-2 border-t border-border/40">
        <p className="text-xs text-muted-foreground mb-2">Durata sondaggio</p>
        <div className="flex flex-wrap gap-1.5">
          {DURATION_PRESETS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ ...pollData, durationPreset: pollData.durationPreset === value ? null : value })}
              disabled={disabled}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                pollData.durationPreset === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {!pollData.durationPreset && (
          <p className="text-[10px] text-muted-foreground mt-1 pl-0.5">Nessun limite di tempo</p>
        )}
      </div>
    </div>
  );
};
