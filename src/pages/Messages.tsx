import { useState } from "react";
import { ArrowLeft, Search, MessageSquarePlus, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMessageThreads } from "@/hooks/useMessageThreads";
import { ThreadList } from "@/components/messages/ThreadList";
import { PeoplePicker } from "@/components/share/PeoplePicker";
import { NewMessageSheet } from "@/components/messages/NewMessageSheet";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { useAuth } from "@/contexts/AuthContext";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { getDisplayUsername } from "@/lib/utils";
import { toast } from "sonner";

export default function Messages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: threads = [], isLoading } = useMessageThreads();
  const { data: currentProfile } = useCurrentProfile();
  const { onlineUsers } = useOnlinePresence();
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Fix: Routing intelligente - verifica thread esistente prima di aprire NewMessageSheet
  const handleStartConversation = async (selectedUserIds: string[]) => {
    if (selectedUserIds.length === 0 || !user) return;
    
    try {
      // 1. Prova a creare/ottenere thread (la funzione DB restituisce sempre l'ID)
      const allParticipants = [user.id, ...selectedUserIds];
      const { data: threadId, error: threadError } = await supabase.rpc('create_or_get_thread', {
        participant_ids: allParticipants
      });
      
      if (threadError) {
        console.error('Error creating/getting thread:', threadError);
        toast.error('Impossibile avviare la conversazione');
        return;
      }

      // 2. Verifica se il thread ha già messaggi
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', threadId);
      
      if (count && count > 0) {
        // Thread esistente con messaggi → Naviga direttamente
        navigate(`/messages/${threadId}`);
        setShowPeoplePicker(false);
        return;
      }
      
      // 3. Thread nuovo o vuoto → Mostra NewMessageSheet
      // Use public_profiles view to avoid exposing sensitive data (DOB, cognitive_density, etc.)
      const { data: profiles, error } = await supabase
        .from('public_profiles')
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

      const usersData = profiles.map(user => ({
        ...user,
        username: getDisplayUsername(user.username)
      }));
      
      setSelectedUsers(usersData);
      setShowPeoplePicker(false);
      setShowNewMessage(true);
    } catch (err) {
      console.error('Error in handleStartConversation:', err);
      toast.error('Si è verificato un errore');
    }
  };

  // Filter threads based on search query
  const filteredThreads = threads.filter((thread) => {
    if (!searchQuery.trim()) return true;
    const participants = thread.participants || [];
    return participants.some((p: any) => {
      const profile = p.profile;
      if (!profile) return false;
      const name = profile.full_name?.toLowerCase() || '';
      const username = profile.username?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      return name.includes(query) || username.includes(query);
    });
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 hover:bg-accent/50 rounded-full transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-semibold text-lg">
              Messaggi
            </span>
          </div>
          <button
            onClick={() => setShowPeoplePicker(true)}
            className="p-2 hover:bg-accent/50 rounded-full transition-colors"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca conversazioni..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-accent/30 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 rounded-xl"
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-accent/50 flex items-center justify-center mb-6">
              <MessageCircle className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">I tuoi messaggi</h3>
            <p className="text-muted-foreground text-center mb-6">
              {searchQuery 
                ? "Nessuna conversazione trovata" 
                : "Inizia una conversazione con i tuoi amici"
              }
            </p>
            {!searchQuery && (
              <Button
                onClick={() => setShowPeoplePicker(true)}
                className="rounded-full px-6"
              >
                Scrivi un messaggio
              </Button>
            )}
          </div>
        ) : (
          <ThreadList 
            threads={filteredThreads} 
            onlineUsers={onlineUsers}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation 
        activeTab="messages"
        onTabChange={(tab) => {
          if (tab === 'home') navigate('/');
          else if (tab === 'search') navigate('/search');
          else if (tab === 'saved') navigate('/saved');
          else if (tab === 'messages') { /* already here */ }
        }}
        onProfileClick={() => navigate('/profile')}
        onHomeRefresh={() => {}}
      />

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
