import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  className?: string;
}

export const TypingIndicator = ({ className }: TypingIndicatorProps) => {
  return (
    <div className={cn("flex gap-1 items-center", className)}>
      <span className="w-2 h-2 bg-primary rounded-full animate-typing-dot" />
      <span className="w-2 h-2 bg-primary rounded-full animate-typing-dot" style={{ animationDelay: '0.2s' }} />
      <span className="w-2 h-2 bg-primary rounded-full animate-typing-dot" style={{ animationDelay: '0.4s' }} />
    </div>
  );
};
