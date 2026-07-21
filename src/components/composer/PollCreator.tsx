import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PollData {
  options: string[];
  durationPreset: '1h' | '6h' | '12h' | '24h' | '3d' | '7d' | null;
  allowMultiple: boolean;
}

interface PollCreatorProps {
  pollData: PollData;
  onChange: (data: PollData) => void;
  onRemove: () => void;
  disabled?: boolean;
}

const DURATION_PRESETS: { value: PollData['durationPreset']; label: string }[] = [
  { value: '1h', label: '1H' },
  { value: '6h', label: '6H' },
  { value: '12h', label: '12H' },
  { value: '24h', label: '24H' },
  { value: '3d', label: '3G' },
  { value: '7d', label: '7G' },
];

const MONO_FONT = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

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
    <div
      style={{
        borderRadius: '20px',
        padding: '16px',
        background: 'rgba(26,35,54,0.72)',
        backdropFilter: 'blur(18px) saturate(150%)',
        WebkitBackdropFilter: 'blur(18px) saturate(150%)',
        border: '1px solid rgba(10,122,255,0.25)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.08) inset',
      }}
      className="space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          style={{
            fontFamily: MONO_FONT,
            fontSize: '10.5px',
            letterSpacing: '0.14em',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: '#6db1ff',
          }}
        >
          ▤ SONDAGGIO
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="h-6 w-6 rounded-full flex items-center justify-center transition-colors hover:bg-white/5"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {pollData.options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <i
              style={{
                fontFamily: MONO_FONT,
                fontSize: '10px',
                color: 'rgba(255,255,255,0.5)',
                width: 16,
                textAlign: 'center',
                fontStyle: 'normal',
                flexShrink: 0,
              }}
            >
              {idx + 1}
            </i>
            <input
              value={opt}
              onChange={(e) => updateOption(idx, e.target.value)}
              placeholder={`Opzione ${idx + 1}`}
              maxLength={200}
              disabled={disabled}
              className="flex-1 outline-none placeholder:text-white/50"
              style={{
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '14.5px',
                background: 'rgba(255,255,255,0.045)',
                boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset',
                border: 'none',
                color: 'rgba(255,255,255,0.92)',
              }}
            />
            {pollData.options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(idx)}
                disabled={disabled}
                className="h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center transition-colors hover:bg-white/5"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
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
          className="pl-[24px] transition-opacity hover:opacity-80"
          style={{
            fontFamily: MONO_FONT,
            fontSize: '10.5px',
            letterSpacing: '0.1em',
            fontWeight: 600,
            color: '#0A7AFF',
          }}
        >
          + AGGIUNGI OPZIONE
        </button>
      )}

      {/* Duration selector */}
      <div className="pt-2 border-t border-white/5">
        <p
          className="mb-2"
          style={{
            fontFamily: MONO_FONT,
            fontSize: '9.5px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          DURATA
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DURATION_PRESETS.map(({ value, label }) => {
            const selected = pollData.durationPreset === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ ...pollData, durationPreset: selected ? null : value })}
                disabled={disabled}
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: '10.5px',
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                  padding: '7px 12px',
                  borderRadius: '999px',
                  color: selected ? '#ffffff' : 'rgba(170,182,198,0.85)',
                  background: selected ? 'rgba(10,122,255,0.85)' : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Multi-select toggle */}
      <div className="pt-2 border-t border-white/5">
        <p
          className="mb-2"
          style={{
            fontFamily: MONO_FONT,
            fontSize: '9.5px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          RISPOSTA
        </p>
        <div className="flex gap-1.5">
          {[
            { value: false, label: 'SCELTA SINGOLA' },
            { value: true, label: 'MULTIPLA' },
          ].map(({ value, label }) => {
            const selected = pollData.allowMultiple === value;
            return (
              <button
                key={String(value)}
                type="button"
                onClick={() => onChange({ ...pollData, allowMultiple: value })}
                disabled={disabled}
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: '10.5px',
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                  padding: '7px 12px',
                  borderRadius: '999px',
                  color: selected ? '#ffffff' : 'rgba(170,182,198,0.85)',
                  background: selected ? 'rgba(10,122,255,0.85)' : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
