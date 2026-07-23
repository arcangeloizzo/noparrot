import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { AuthPromptSheet } from "@/components/auth/AuthPromptSheet";
import { useAuth } from "@/contexts/AuthContext";

interface AuthPromptContextValue {
  /** Open the auth prompt sheet. */
  promptAuth: () => void;
  /**
   * Guard helper: returns true when the user is authenticated, otherwise
   * opens the prompt sheet and returns false. Use before triggering any
   * mutation that requires an account.
   *
   * Example:
   *   if (!requireAuth()) return;
   */
  requireAuth: () => boolean;
}

const AuthPromptContext = createContext<AuthPromptContextValue>({
  promptAuth: () => {},
  requireAuth: () => true,
});

export const AuthPromptProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  const promptAuth = useCallback(() => setOpen(true), []);

  const requireAuth = useCallback(() => {
    if (user) return true;
    setOpen(true);
    return false;
  }, [user]);

  return (
    <AuthPromptContext.Provider value={{ promptAuth, requireAuth }}>
      {children}
      <AuthPromptSheet open={open} onClose={() => setOpen(false)} />
    </AuthPromptContext.Provider>
  );
};

export const useAuthPrompt = () => useContext(AuthPromptContext);