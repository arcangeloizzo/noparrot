import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  message?: string;
  submessage?: string;
}

export const LoadingOverlay = ({ message, submessage }: LoadingOverlayProps) => {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl max-w-sm mx-4 animate-scale-in">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="absolute inset-0 h-12 w-12 rounded-full bg-primary/20 blur-xl animate-pulse" />
          </div>
          {message && (
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold text-foreground">{message}</p>
              {submessage && (
                <p className="text-sm text-muted-foreground">{submessage}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
