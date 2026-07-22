import { useMemo, useState } from "react";
import { Search, MessageSquarePlus, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMessageThreads } from "@/hooks/useMessageThreads";
import { ThreadList } from "@/components/messages/ThreadList";
import { ThreadListSkeleton } from "@/components/messages/ThreadListSkeleton";
import { PeoplePicker } from "@/components/share/PeoplePicker";
import { NewMessageSheet } from "@/components/messages/NewMessageSheet";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { useAuth } from "@/contexts/AuthContext";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { ComposerModal } from "@/components/composer/ComposerModal";
import { getDisplayUsername } from "@/lib/utils";
import { toast } from "sonner";

type ThreadFilter = "all" | "unread" | "groups";

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
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [filter, setFilter] = useState<ThreadFilter>("all");

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

  const unreadTotal = useMemo(
    () => threads.reduce((sum, t) => sum + (t.unread_count || 0), 0),
    [threads]
  );

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return threads.filter((thread) => {
      // filter chip
      if (filter === "unread" && (thread.unread_count || 0) === 0) return false;
      if (filter === "groups") {
        const others = (thread.participants || []).filter(
          (p: any) => p.user_id !== user?.id
        );
        if (others.length < 2) return false;
      }
      // search
      if (!q) return true;
      const participants = thread.participants || [];
      return participants.some((p: any) => {
        const profile = p.profile;
        if (!profile) return false;
        const name = profile.full_name?.toLowerCase() || "";
        const username = profile.username?.toLowerCase() || "";
        return name.includes(q) || username.includes(q);
      });
    });
  }, [threads, searchQuery, filter, user?.id]);

  return (
    <div className="shell-page">
      {/* Header — Anton title left, action right */}
      <header className="shell-header">
        <div className="flex items-start justify-between">
          <h1 className="shell-title">Messaggi</h1>
          <button
            type="button"
            onClick={() => setShowPeoplePicker(true)}
            className="flex-shrink-0 rounded-full flex items-center justify-center transition-colors"
            style={{
              width: 40,
              height: 40,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--txt)",
            }}
            aria-label="Nuova conversazione"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
        </div>

        {/* Glass search */}
        <div className="relative mt-4">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--txt-3)" }}
          />
          <input
            type="search"
            placeholder="Cerca conversazioni…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              height: 46,
              borderRadius: 23,
              paddingLeft: 44,
              paddingRight: 16,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "var(--txt)",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>
      </header>

      {/* Filter rail */}
      <div className="filter-rail" style={{ paddingTop: 0, paddingBottom: 12 }}>
        <button
          className="pill-filter"
          data-active={filter === "all"}
          onClick={() => setFilter("all")}
        >
          Tutti
        </button>
        <button
          className="pill-filter"
          data-active={filter === "unread"}
          onClick={() => setFilter("unread")}
        >
          Non letti{unreadTotal > 0 ? ` · ${unreadTotal}` : ""}
        </button>
        <button
          className="pill-filter"
          data-active={filter === "groups"}
          onClick={() => setFilter("groups")}
        >
          Gruppi
        </button>
      </div>

      {/* Content */}
      <div>
        {isLoading && threads.length === 0 ? (
          <ThreadListSkeleton />
        ) : filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 animate-fade-in">
            <div
              className="rounded-full flex items-center justify-center mb-6"
              style={{
                width: 72,
                height: 72,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <MessageCircle className="h-9 w-9" style={{ color: "var(--txt-3)" }} />
            </div>
            <h3 className="shell-title mb-2" style={{ fontSize: 22 }}>I tuoi messaggi</h3>
            <p className="text-center mb-6" style={{ color: "var(--txt-3)", fontSize: 14 }}>
              {searchQuery
                ? "Nessuna conversazione trovata"
                : filter === "unread"
                ? "Sei in pari con tutto."
                : filter === "groups"
                ? "Nessun gruppo, ancora."
                : "Inizia una conversazione con i tuoi amici"}
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
        }}
        onProfileClick={() => navigate('/profile')}
        onHomeRefresh={() => {}}
        onComposerClick={() => setIsComposerOpen(true)}
      />

      {/* Composer Modal */}
      <ComposerModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
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
