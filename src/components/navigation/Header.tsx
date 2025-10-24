import { Send } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/ui/logo";
import { useMessageThreads } from "@/hooks/useMessageThreads";

export const Header = () => {
  const { data: threads } = useMessageThreads();

  // Calcola messaggi non letti totali
  const unreadCount = threads?.reduce((sum, thread) => sum + (thread.unread_count || 0), 0) || 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-[4.375rem] max-w-screen-xl items-center justify-between px-4">
        {/* Logo centrale */}
        <div className="flex-1" />
        
        <div className="flex items-center justify-center">
          <Logo className="h-10" />
        </div>

        {/* Icona messaggi a destra */}
        <div className="flex flex-1 items-center justify-end">
          <Link
            to="/messages"
            className="relative flex items-center justify-center w-12 h-12 rounded-full hover:bg-accent transition-colors"
          >
            <Send className="h-6 w-6" />
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-semibold rounded-full min-w-[22px] h-6 flex items-center justify-center px-2">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
};
