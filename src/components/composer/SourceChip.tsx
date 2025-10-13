// SourceChip - Individual source chip with gate state indicator
// =============================================================
// ✅ Shows source URL/title with colored state indicator
// ✅ Tooltip with Comprehension Gate status
// ✅ Remove functionality for the composer

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SourceWithGate, getChipState } from '@/lib/comprehension-gate-extended';

interface SourceChipProps {
  source: SourceWithGate;
  onRemove: () => void;
  className?: string;
}

export const SourceChip: React.FC<SourceChipProps> = ({
  source,
  onRemove,
  className
}) => {
  const chipState = getChipState(source.state);

  return (
    <div 
      className={cn(
        "inline-flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 text-sm group hover:bg-muted/50 transition-colors",
        className
      )}
      title={chipState.tooltip}
    >
      {/* State Indicator */}
      <div className={cn(
        "w-2 h-2 rounded-full flex-shrink-0",
        chipState.color.includes('animate-pulse') && "animate-pulse",
        source.state === 'pending' && "bg-muted-foreground",
        source.state === 'reading' && "bg-primary",
        source.state === 'testing' && "bg-accent", 
        source.state === 'passed' && "bg-trust-high",
        source.state === 'failed' && "bg-trust-low"
      )} />

      {/* Source Info */}
      <div className="flex-1 min-w-0">
        <span className="text-foreground font-medium truncate block">
          {source.title || 'Fonte'}
        </span>
        <span className="text-muted-foreground text-xs truncate block">
          {source.url}
        </span>
      </div>

      {/* State Icon */}
      <span className="text-xs flex-shrink-0">
        {chipState.icon}
      </span>

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          onRemove();
        }}
        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};