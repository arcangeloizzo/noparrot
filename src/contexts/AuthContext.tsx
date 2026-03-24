import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { restoreSessionFromUrlHash } from '@/lib/authUrlSession';

const AUTH_INIT_TIMEOUT_MS = 6000;

const clearStoredAuthState = () => {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-') || key === 'noparrot-needs-age-gate') {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('[Auth] Failed to clear local auth state', error);
  }
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authReady: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUpStep1: (email: string, password: string, fullName: string, dateOfBirth: string) => Promise<{ error: any; needsEmailConfirmation?: boolean }>;
  verifyEmailOTP: (email: string, otp: string) => Promise<{ error: any }>;
  completeProfile: (username: string, avatarFile?: File) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateAvatar: (file: File) => Promise<{ error: any; url?: string }>;
  updateProfile: (data: { full_name?: string; username?: string; bio?: string; email?: string }) => Promise<{ error: any; requiresEmailVerification?: boolean }>;
  verifyEmailChangeOTP: (newEmail: string, otp: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  // Track which user ID we already synced for, to avoid re-running on token refresh
  const syncedForUserRef = useRef<string | null>(null);

  // ===== STEP 1: Pure auth bootstrap — no side effects =====
  useEffect(() => {
    let isMounted = true;
    let isBootstrapped = false;

    const applySession = (nextSession: Session | null) => {
      if (!isMounted) return;
      isBootstrapped = true;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
      setAuthReady(true);
    };

    const recoverFromBrokenBootstrap = (reason: string, error?: unknown) => {
      console.warn(`[Auth] ${reason}`, error);
      clearStoredAuthState();
      applySession(null);
    };

    const timeoutId = window.setTimeout(() => {
      if (isBootstrapped) return;
      recoverFromBrokenBootstrap('Session bootstrap timed out, clearing stale local auth state');
    }, AUTH_INIT_TIMEOUT_MS);

    // Listener: PURE state updates only — no backend calls
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        window.clearTimeout(timeoutId);
        applySession(nextSession);
      }
    );

    // Initial session check
    void (async () => {
      try {
        const restoredSession = await restoreSessionFromUrlHash();
        if (restoredSession) {
          window.clearTimeout(timeoutId);
          applySession(restoredSession);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        window.clearTimeout(timeoutId);
        applySession(session);
      } catch (error) {
        window.clearTimeout(timeoutId);
        recoverFromBrokenBootstrap('getSession failed during bootstrap', error);
      }
    })();

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  // ===== STEP 2: Side effects AFTER auth is stable =====
  // Runs once per unique user login, deferred to next tick
  useEffect(() => {
    if (!authReady || !user) {
      // Reset sync tracker on logout
      if (!user) syncedForUserRef.current = null;
      return;
    }

    // Skip if we already synced for this user (avoids re-running on token refresh)
    if (syncedForUserRef.current === user.id) return;
    syncedForUserRef.current = user.id;

    // Defer to next tick so it doesn't block onAuthStateChange completion
    const timerId = setTimeout(() => {
      void (async () => {
        try {
          const { syncPendingConsents } = await import('@/hooks/useUserConsents');
          syncPendingConsents(user.id);
        } catch (error) {
          console.warn('[Auth] Failed to sync pending consents', error);
        }

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('date_of_birth')
            .eq('id', user.id)
            .maybeSingle();

          if (profile && !profile.date_of_birth) {
            localStorage.setItem('noparrot-needs-age-gate', 'true');
          } else {
            localStorage.removeItem('noparrot-needs-age-gate');
          }
        } catch {
          localStorage.removeItem('noparrot-needs-age-gate');
        }
      })();
    }, 100);

    return () => clearTimeout(timerId);
  }, [authReady, user]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (!error && data.session) {
      setSession(data.session);
      setUser(data.user);
      setLoading(false);
      setAuthReady(true);
      // Side effects will be triggered by the useEffect above
    }

    return { error };
  };

  const signUpStep1 = async (email: string, password: string, fullName: string, dateOfBirth: string) => {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age < 16) {
      return { error: { message: 'Devi avere almeno 16 anni per registrarti' } };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName,
          date_of_birth: dateOfBirth,
        }
      }
    });

    if (error) return { error };
    return { error: null, needsEmailConfirmation: true };
  };

  const verifyEmailOTP = async (email: string, otp: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'signup'
    });
    return { error };
  };

  const completeProfile = async (username: string, avatarFile?: File) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data: isValid, error: validationError } = await supabase.rpc('is_valid_username', { username });
    if (validationError || !isValid) {
      return { error: { message: 'Username non valido o già in uso' } };
    }

    let avatarUrl: string | null = null;
    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, { cacheControl: '3600', upsert: true });

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrl = publicUrl;
      }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username, ...(avatarUrl && { avatar_url: avatarUrl }) })
      .eq('id', user.id);

    if (updateError) return { error: updateError };
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName }
      }
    });
    return { error };
  };

  const updateAvatar = async (file: File) => {
    if (!user) return { error: new Error('Not authenticated') };

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { cacheControl: '3600', upsert: true });

    if (uploadError) return { error: uploadError };

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    if (updateError) return { error: updateError };
    return { error: null, url: publicUrl };
  };

  const updateProfile = async (data: { full_name?: string; username?: string; bio?: string; email?: string }) => {
    if (!user) return { error: new Error('Not authenticated') };

    if (data.email && data.email !== user.email) {
      const { error } = await supabase.auth.updateUser({ email: data.email });
      if (error) return { error };
      return { error: null, requiresEmailVerification: true };
    }

    if (data.username) {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      
      if (data.username !== currentProfile?.username) {
        const { data: isValid, error: validationError } = await supabase.rpc('is_valid_username', { username: data.username });
        if (validationError || !isValid) {
          return { error: { message: 'Username non valido o già in uso' } };
        }
      }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        ...(data.full_name && { full_name: data.full_name }),
        ...(data.username && { username: data.username }),
        ...(data.bio !== undefined && { bio: data.bio })
      })
      .eq('id', user.id);

    if (updateError) return { error: updateError };
    return { error: null };
  };

  const verifyEmailChangeOTP = async (newEmail: string, otp: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email: newEmail,
      token: otp,
      type: 'email_change'
    });
    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[Auth] signOut API failed, clearing local session', e);
    } finally {
      clearStoredAuthState();
      setUser(null);
      setSession(null);
      setLoading(false);
      setAuthReady(true);
      syncedForUserRef.current = null;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      authReady,
      signIn, 
      signUpStep1, 
      verifyEmailOTP, 
      completeProfile, 
      signUp, 
      signOut, 
      updateAvatar, 
      updateProfile, 
      verifyEmailChangeOTP 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
