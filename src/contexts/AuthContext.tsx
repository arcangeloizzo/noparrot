import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

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

const syncPostAuthState = async (event: AuthChangeEvent, userId: string) => {
  if (event !== 'SIGNED_IN' && event !== 'USER_UPDATED') return;

  try {
    const { syncPendingConsents } = await import('@/hooks/useUserConsents');
    syncPendingConsents(userId);
  } catch (error) {
    console.warn('[Auth] Failed to sync pending consents', error);
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('date_of_birth')
      .eq('id', userId)
      .maybeSingle();

    if (profile && !profile.date_of_birth) {
      localStorage.setItem('noparrot-needs-age-gate', 'true');
    } else {
      localStorage.removeItem('noparrot-needs-age-gate');
    }
  } catch {
    localStorage.removeItem('noparrot-needs-age-gate');
  }
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
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

  useEffect(() => {
    let isMounted = true;
    let isBootstrapped = false;

    const applySession = (nextSession: Session | null) => {
      if (!isMounted) return;

      isBootstrapped = true;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
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

    // Listener per cambiamenti autenticazione
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        window.clearTimeout(timeoutId);
        applySession(nextSession);

        if (nextSession?.user) {
          void syncPostAuthState(event, nextSession.user.id);
        } else {
          localStorage.removeItem('noparrot-needs-age-gate');
        }
      }
    );

    // Controlla sessione esistente
    void supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) throw error;
        window.clearTimeout(timeoutId);
        applySession(session);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        recoverFromBrokenBootstrap('getSession failed during bootstrap, clearing stale local auth state', error);
      });

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };

  const signUpStep1 = async (email: string, password: string, fullName: string, dateOfBirth: string) => {
    // Validazione età (>=16 anni) - GDPR Art.8
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

    // Valida username
    const { data: isValid, error: validationError } = await supabase.rpc('is_valid_username', { username });
    if (validationError || !isValid) {
      return { error: { message: 'Username non valido o già in uso' } };
    }

    // Upload avatar se presente
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

    // Aggiorna profilo
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

    // Se cambio email, richiedo OTP
    if (data.email && data.email !== user.email) {
      const { error } = await supabase.auth.updateUser({ email: data.email });
      if (error) return { error };
      return { error: null, requiresEmailVerification: true };
    }

    // Valida username solo se effettivamente modificato
    if (data.username) {
      // Fetch current username per confronto
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      
      // Valida solo se username è diverso dal corrente
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
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
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
