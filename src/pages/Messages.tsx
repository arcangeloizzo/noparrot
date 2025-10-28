import { ArrowLeft, MessageSquarePlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThreadList } from "@/components/messages/ThreadList";
import { useMessageThreads } from "@/hooks/useMessageThreads";
import { PeoplePicker } from "@/components/share/PeoplePicker";
import { NewMessageSheet } from "@/components/messages/NewMessageSheet";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDisplayUsername } from "@/lib/utils";
import { toast } from "sonner";

export default function Messages() {
  const navigate = useNavigate();
  const { data: threads, isLoading } = useMessageThreads();
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);

  const handleStartConversation = async (selectedUserIds: string[]) => {
    if (selectedUserIds.length === 0) return;
    
    // Recupera profili REALI dal database
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', selectedUserIds);

    if (error) {
      console.error('Error fetching user profiles:', error);
      toast.error('Impossibile recuperare i profili utente');
      return;
    }

    if (!profiles || profiles.length === 0) {
      toast.error('Nessun utente trovato');
      return;
    }

    // Applica getDisplayUsername per nascondere email
    const usersData = profiles.map(user => ({
      ...user,
      username: getDisplayUsername(user.username)
    }));
    
    setSelectedUsers(usersData);
    setShowPeoplePicker(false);
    setShowNewMessage(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Messaggi</h1>
        </div>
      </div>

      {/* Lista thread */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      ) : threads && threads.length > 0 ? (
        <ThreadList threads={threads} />
      ) : (
        <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
          <p className="text-lg font-semibold mb-2">Nessun messaggio</p>
          <p className="text-muted-foreground text-sm">
            Inizia una conversazione condividendo un post con un amico!
          </p>
        </div>
      )}

      {/* FAB Nuova conversazione - Enhanced */}
      <button
        onClick={() => setShowPeoplePicker(true)}
        className="group fixed w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center z-10 transition-all duration-300 hover:scale-110 hover:shadow-2xl active:scale-95"
        style={{ 
          right: 'max(20px, env(safe-area-inset-right))',
          bottom: 'calc(88px + env(safe-area-inset-bottom))',
          boxShadow: '0 8px 32px hsl(var(--primary) / 0.4), 0 4px 16px rgba(0,0,0,.24)'
        }}
        aria-label="Nuova conversazione"
      >
        <MessageSquarePlus className="h-6 w-6 transition-transform group-hover:rotate-12" />
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
      </button>

      {/* People Picker */}
      <PeoplePicker
        isOpen={showPeoplePicker}
        onClose={() => setShowPeoplePicker(false)}
        onSend={handleStartConversation}
      />

      {/* New Message Sheet */}
      <NewMessageSheet
        isOpen={showNewMessage}
        onClose={() => {
          setShowNewMessage(false);
          setSelectedUsers([]);
        }}
        selectedUsers={selectedUsers}
      />
    </div>
  );
}
