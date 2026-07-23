import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Check, Circle, ArrowLeft, X, ExternalLink } from "lucide-react";
import { LogoVertical } from "@/components/ui/LogoVertical";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { PENDING_SHARE_KEY } from "@/pages/ShareTargetHandler";
import { restoreSessionFromUrlHash } from "@/lib/authUrlSession";
import { checkPassword, mapPasswordError, PASSWORD_POLICY } from "@/config/passwordPolicy";
import {
  savePendingConsent,
  setConsentCompleted,
  useUpsertConsents,
} from "@/hooks/useUserConsents";

export interface AuthPageProps {
  initialMode?: "login" | "signup";
  forcePasswordReset?: boolean;
}

// ------------------------------------------------------------------
// Shell tokens (TICKET-07A: explicit values, no CSS vars in inline styles)
// ------------------------------------------------------------------
const BASE = "#0E1522";
const BLUE = "#0A7AFF";
const TEAL = "#06B6D4";
const PINK = "#E41E52";
const TXT = "#FFFFFF";
const TXT_SOFT = "rgba(255,255,255,0.74)";
const TXT_MUTED = "rgba(255,255,255,0.55)";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const ANTON = "'Anton', 'Impact', sans-serif";

// Age gate helpers
const AGE_GATE_FAILED_KEY = "age_gate_failed";
const AGE_GATE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const NEEDS_AGE_GATE_KEY = "noparrot-needs-age-gate";

function calculateAge(dateOfBirth: string): number {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

// ------------------------------------------------------------------
// Shell primitives
// ------------------------------------------------------------------
const Shell = ({
  onClose,
  onBack,
  children,
}: {
  onClose?: () => void;
  onBack?: () => void;
  children: React.ReactNode;
}) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 60,
      background: BASE,
      color: TXT,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "max(env(safe-area-inset-top, 0px), 12px) 16px 6px 16px",
        flexShrink: 0,
      }}
    >
      <div style={{ width: 40, display: "flex", alignItems: "center" }}>
        {onBack ? (
          <button
            onClick={onBack}
            aria-label="Indietro"
            style={{
              background: "transparent",
              border: "none",
              color: TXT_MUTED,
              padding: 8,
              margin: -8,
              cursor: "pointer",
              display: "inline-flex",
            }}
          >
            <ArrowLeft size={22} strokeWidth={2} />
          </button>
        ) : null}
      </div>
      <div style={{ width: 40, display: "flex", justifyContent: "flex-end" }}>
        {onClose ? (
          <button
            onClick={onClose}
            aria-label="Chiudi"
            style={{
              background: "transparent",
              border: "none",
              color: TXT_MUTED,
              padding: 8,
              margin: -8,
              cursor: "pointer",
              display: "inline-flex",
            }}
          >
            <X size={22} strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "8px 24px max(env(safe-area-inset-bottom, 0px), 28px) 24px",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>{children}</div>
    </div>
  </div>
);

const Eyebrow = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <div
    style={{
      fontFamily: MONO,
      fontSize: 10.5,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color,
      marginBottom: 12,
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}
  >
    {children}
  </div>
);

const Title = ({ children }: { children: React.ReactNode }) => (
  <h1
    style={{
      fontFamily: ANTON,
      fontSize: 40,
      lineHeight: 0.98,
      letterSpacing: "0.005em",
      textTransform: "uppercase",
      color: TXT,
      margin: 0,
    }}
  >
    {children}
  </h1>
);

const Subtitle = ({ children }: { children: React.ReactNode }) => (
  <p
    style={{
      fontFamily: "Inter, sans-serif",
      fontSize: 15,
      lineHeight: 1.5,
      color: TXT_SOFT,
      margin: "14px 0 24px 0",
    }}
  >
    {children}
  </p>
);

const StepRail = ({ current, total = 3 }: { current: number; total?: number }) => (
  <div style={{ display: "flex", gap: 6, marginTop: 14, marginBottom: 22 }}>
    {Array.from({ length: total }).map((_, i) => {
      const active = i === current - 1;
      const done = i < current - 1;
      return (
        <div
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: done ? TEAL : active ? BLUE : "rgba(255,255,255,0.12)",
            boxShadow: active ? "0 0 10px rgba(10,122,255,0.55)" : "none",
            transition: "all 200ms ease",
          }}
        />
      );
    })}
  </div>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label
    style={{
      display: "block",
      fontFamily: MONO,
      fontSize: 10,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: TXT_MUTED,
      marginBottom: 6,
    }}
  >
    {children}
  </label>
);

const glassInputStyle = (invalid?: boolean, ok?: boolean): React.CSSProperties => ({
  width: "100%",
  height: 48,
  padding: "0 14px",
  borderRadius: 14,
  background: "rgba(26, 35, 54, 0.72)",
  border: `1px solid ${
    invalid ? "rgba(228,30,82,0.6)" : ok ? "rgba(6,182,212,0.55)" : "rgba(255,255,255,0.08)"
  }`,
  color: TXT,
  fontFamily: "Inter, sans-serif",
  fontSize: 15,
  outline: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
});

const GlassInput = ({
  invalid,
  ok,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; ok?: boolean }) => (
  <input {...rest} style={{ ...glassInputStyle(invalid, ok), ...(rest.style ?? {}) }} />
);

const PrimaryButton = ({
  children,
  onClick,
  disabled,
  type = "button",
  color = BLUE,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  color?: string;
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    style={{
      width: "100%",
      height: 54,
      borderRadius: 26,
      background: disabled ? "rgba(10,122,255,0.35)" : color,
      color: TXT,
      border: "none",
      fontFamily: "Inter, sans-serif",
      fontSize: 15.5,
      fontWeight: 600,
      letterSpacing: "0.01em",
      cursor: disabled ? "not-allowed" : "pointer",
      boxShadow: disabled ? "none" : "0 10px 30px rgba(10,122,255,0.28)",
      transition: "all 180ms ease",
    }}
  >
    {children}
  </button>
);

const GhostLink = ({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      background: "transparent",
      border: "none",
      color: TXT_MUTED,
      fontFamily: MONO,
      fontSize: 10,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      padding: "12px 4px",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      width: "100%",
      textAlign: "center",
    }}
  >
    {children}
  </button>
);

const GoogleButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      width: "100%",
      height: 50,
      borderRadius: 25,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.10)",
      color: TXT,
      fontFamily: "Inter, sans-serif",
      fontSize: 14.5,
      fontWeight: 500,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      cursor: "pointer",
    }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
    {label}
  </button>
);

const Divider = ({ label }: { label: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
    <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: TXT_MUTED }}>
      {label}
    </span>
    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
  </div>
);

// Glass select (wraps shadcn Select with dark trigger styling via className)
const GlassSelect = ({
  value,
  onValueChange,
  placeholder,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger
      className="border-none"
      style={{
        ...glassInputStyle(),
        height: 48,
        padding: "0 12px",
        color: value ? TXT : TXT_MUTED,
      }}
    >
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>{children}</SelectContent>
  </Select>
);

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
export const AuthPage = ({ initialMode = "login", forcePasswordReset = false }: AuthPageProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawNext = searchParams.get("next") ?? searchParams.get("redirect");
  const nextPath =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;
  const oauthRedirectUri = nextPath
    ? `${window.location.origin}/auth?next=${encodeURIComponent(nextPath)}`
    : window.location.origin;
  const { user, signIn, signUpStep1, verifyEmailOTP, completeProfile } = useAuth();
  const upsertConsents = useUpsertConsents();

  // ---- modes/steps ----
  const [isLogin, setIsLogin] = useState(initialMode === "login");
  // 1 = data, 2 = password, 3 = consent (+ signUp), 4 = OTP, 5 = avatar
  const [registrationStep, setRegistrationStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showUpdatePassword, setShowUpdatePassword] = useState(forcePasswordReset);
  const [newPassword, setNewPassword] = useState("");

  // OAuth age gate
  const [showOAuthAgeGate, setShowOAuthAgeGate] = useState(false);
  const [oauthDay, setOauthDay] = useState("");
  const [oauthMonth, setOauthMonth] = useState("");
  const [oauthYear, setOauthYear] = useState("");

  const [ageGateBlocked, setAgeGateBlocked] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 1 data
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dayOfBirth, setDayOfBirth] = useState("");
  const [monthOfBirth, setMonthOfBirth] = useState("");
  const [yearOfBirth, setYearOfBirth] = useState("");

  // Step 3 consent
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [adsOptIn, setAdsOptIn] = useState(false);
  const [cognitiveOptIn, setCognitiveOptIn] = useState(false);

  // Step 4 OTP
  const [otp, setOtp] = useState("");

  // Step 5 avatar + username
  const [username, setUsername] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // ---- effects ----
  useEffect(() => {
    const failedTs = localStorage.getItem(AGE_GATE_FAILED_KEY);
    if (failedTs) {
      const elapsed = Date.now() - parseInt(failedTs, 10);
      if (elapsed < AGE_GATE_COOLDOWN_MS) {
        setAgeGateBlocked(true);
      } else {
        localStorage.removeItem(AGE_GATE_FAILED_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (user && !showUpdatePassword) {
      // If we're mid-registration (OTP just verified, awaiting avatar step), do not redirect
      if (!isLogin && registrationStep >= 4 && registrationStep <= 5) return;

      if (localStorage.getItem(NEEDS_AGE_GATE_KEY) === "true") {
        setShowOAuthAgeGate(true);
        return;
      }
      if (localStorage.getItem(PENDING_SHARE_KEY) === "true") {
        localStorage.removeItem(PENDING_SHARE_KEY);
        navigate("/", { replace: true, state: { openComposer: true } });
      } else {
        navigate(nextPath ?? "/", { replace: true });
      }
    }
  }, [user, navigate, showUpdatePassword, nextPath, isLogin, registrationStep]);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get("type") === "recovery") setShowUpdatePassword(true);
  }, []);

  // Auto-suggest username from email
  useEffect(() => {
    if (email && email.includes("@") && !username) {
      const suggested = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_");
      setUsername(suggested.toLowerCase());
    }
  }, [email, username]);

  // Username availability
  useEffect(() => {
    if (!username || username.length < 4) {
      setUsernameAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", username)
        .maybeSingle();
      if (error) setUsernameAvailable(null);
      else setUsernameAvailable(data === null);
      setCheckingUsername(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  // ---- password checklist ----
  const pwChecks = useMemo(() => checkPassword(password), [password]);

  // ---- handlers ----
  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email || !dayOfBirth || !monthOfBirth || !yearOfBirth) {
      toast.error("Compila tutti i campi");
      return;
    }
    // basic email sanity
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Inserisci un'email valida");
      return;
    }
    setRegistrationStep(2);
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      toast.error("Inserisci e conferma la password");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Le password non corrispondono");
      return;
    }
    if (!pwChecks.ok) {
      toast.error(`La password deve essere di almeno ${PASSWORD_POLICY.minLength} caratteri.`);
      return;
    }
    setRegistrationStep(3);
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted || !privacyAcknowledged) {
      toast.error("Accetta Termini e Privacy per continuare");
      return;
    }
    setIsLoading(true);

    // Persist consent BEFORE signup so we don't lose it if the user closes the tab
    savePendingConsent({
      accepted_terms: true,
      accepted_privacy: true,
      ads_personalization_opt_in: adsOptIn,
      consent_version: "2.0",
    });
    localStorage.setItem(
      "noparrot-pending-cognitive-opt-in",
      JSON.stringify(cognitiveOptIn),
    );
    setConsentCompleted();

    const dateOfBirth = `${yearOfBirth}-${monthOfBirth.padStart(2, "0")}-${dayOfBirth.padStart(2, "0")}`;
    const cleanFullName = fullName.trim() || null;
    const { error } = await signUpStep1(email, password, cleanFullName, dateOfBirth);

    if (error) {
      if (error.message?.includes("16 anni")) {
        localStorage.setItem(AGE_GATE_FAILED_KEY, Date.now().toString());
        setAgeGateBlocked(true);
        toast.error(error.message);
      } else if (
        (error as { error_code?: string }).error_code === "weak_password" ||
        error.message?.toLowerCase().includes("weak") ||
        error.message?.toLowerCase().includes("pwned") ||
        error.message?.toLowerCase().includes("known to be weak")
      ) {
        toast.error(mapPasswordError(error));
        setRegistrationStep(2);
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Codice di verifica inviato alla tua email!");
      setRegistrationStep(4);
    }
    setIsLoading(false);
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Inserisci il codice a 6 cifre");
      return;
    }
    setIsLoading(true);
    const { error } = await verifyEmailOTP(email, otp);
    if (error) {
      toast.error("Codice non valido");
      setIsLoading(false);
      return;
    }

    // Consents to DB now that user is authenticated
    try {
      await upsertConsents.mutateAsync({
        accepted_terms: true,
        accepted_privacy: true,
        ads_personalization_opt_in: adsOptIn,
        consent_version: "2.0",
      });
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      if (freshUser) {
        await supabase
          .from("profiles")
          .update({ cognitive_tracking_enabled: cognitiveOptIn })
          .eq("id", freshUser.id);
      }
    } catch (err) {
      console.warn("[Auth] Failed to sync consents right after OTP", err);
    }

    toast.success("Email verificata!");
    setRegistrationStep(5);
    setIsLoading(false);
  };

  const handleAvatarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || username.length < 4 || username.length > 15) {
      toast.error("Username deve essere 4-15 caratteri");
      return;
    }
    if (usernameAvailable === false) {
      toast.error("Username già in uso");
      return;
    }
    setIsLoading(true);
    const { error } = await completeProfile(username, avatarFile || undefined);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Registrazione completata!");
      if (localStorage.getItem(PENDING_SHARE_KEY) === "true") {
        localStorage.removeItem(PENDING_SHARE_KEY);
        navigate("/", { replace: true, state: { openComposer: true } });
      } else {
        navigate("/");
      }
    }
    setIsLoading(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Email o password non corretti"
          : error.message,
      );
    } else {
      toast.success("Login effettuato!");
    }
    setIsLoading(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Link di recupero inviato alla tua email!");
      setShowForgotPassword(false);
      setResetEmail("");
    }
    setIsLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (newPassword !== confirmPassword) {
      toast.error("Le password non corrispondono");
      setIsLoading(false);
      return;
    }
    if (!checkPassword(newPassword).ok) {
      toast.error(`La password deve essere di almeno ${PASSWORD_POLICY.minLength} caratteri.`);
      setIsLoading(false);
      return;
    }

    try {
      await restoreSessionFromUrlHash();
      const { data: { session: recoverySession }, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!recoverySession) throw new Error("missing_recovery_session");

      const updatePromise = supabase.auth.updateUser({ password: newPassword });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 15000),
      );
      const { error } = await Promise.race([updatePromise, timeoutPromise]);

      if (error) {
        toast.error(mapPasswordError(error));
      } else {
        const { data: { session: nextSession } } = await supabase.auth.getSession();
        toast.success("Password aggiornata con successo!");
        setShowUpdatePassword(false);
        setNewPassword("");
        setConfirmPassword("");
        window.history.replaceState({}, document.title, window.location.pathname);
        if (nextSession?.user) navigate("/", { replace: true });
        else navigate("/auth", { replace: true });
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      if (msg === "timeout") toast.error("La richiesta ha impiegato troppo tempo. Riprova.");
      else if (msg === "missing_recovery_session")
        toast.error("Link di recupero non valido o scaduto. Richiedine uno nuovo.");
      else toast.error("Errore di rete. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthAgeGate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oauthDay || !oauthMonth || !oauthYear || !user) return;
    setIsLoading(true);

    const dateOfBirth = `${oauthYear}-${oauthMonth.padStart(2, "0")}-${oauthDay.padStart(2, "0")}`;
    const age = calculateAge(dateOfBirth);

    if (age < 16) {
      localStorage.setItem(AGE_GATE_FAILED_KEY, Date.now().toString());
      setAgeGateBlocked(true);
      setShowOAuthAgeGate(false);
      toast.error("Devi avere almeno 16 anni per usare NoParrot");
      await supabase.auth.signOut();
      setIsLoading(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ date_of_birth: dateOfBirth })
      .eq("id", user.id);

    if (error) toast.error("Errore nel salvataggio. Riprova.");
    else {
      localStorage.removeItem(NEEDS_AGE_GATE_KEY);
      setShowOAuthAgeGate(false);
      toast.success("Profilo completato!");
      navigate("/", { replace: true });
    }
    setIsLoading(false);
  };

  const handleGoogle = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: oauthRedirectUri,
    });
    if (error) toast.error("Errore con Google: " + error.message);
  };

  // ---- helpers ----
  const closeAuth = () => navigate(nextPath ?? "/", { replace: true });

  // ==================================================================
  // RENDER — sub-views first
  // ==================================================================

  // OAUTH AGE GATE
  if (showOAuthAgeGate) {
    return (
      <Shell>
        <Eyebrow color={PINK}>Completa la registrazione</Eyebrow>
        <Title>DATA DI NASCITA.</Title>
        <Subtitle>Serve solo per verificare che tu abbia almeno 16 anni.</Subtitle>

        <form onSubmit={handleOAuthAgeGate}>
          <FieldLabel>Data di nascita</FieldLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: 8, marginBottom: 18 }}>
            <GlassSelect value={oauthDay} onValueChange={setOauthDay} placeholder="Giorno">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)}>{d}</SelectItem>
              ))}
            </GlassSelect>
            <GlassSelect value={oauthMonth} onValueChange={setOauthMonth} placeholder="Mese">
              {["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"].map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </GlassSelect>
            <GlassSelect value={oauthYear} onValueChange={setOauthYear} placeholder="Anno">
              {Array.from({ length: 85 }, (_, i) => new Date().getFullYear() - 16 - i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </GlassSelect>
          </div>
          <PrimaryButton type="submit" disabled={isLoading || !oauthDay || !oauthMonth || !oauthYear}>
            {isLoading ? "Salvataggio…" : "Conferma e continua"}
          </PrimaryButton>
        </form>
      </Shell>
    );
  }

  // AGE GATE BLOCKED
  if (ageGateBlocked) {
    return (
      <Shell onClose={closeAuth}>
        <Eyebrow color={PINK}>Registrazione non disponibile</Eyebrow>
        <Title>
          RIPROVA
          <br />
          PIÙ TARDI.
        </Title>
        <Subtitle>
          NoParrot è riservato a chi ha almeno 16 anni. Potrai riprovare tra 24 ore.
        </Subtitle>
        <PrimaryButton
          onClick={() => {
            setIsLogin(true);
            setAgeGateBlocked(false);
          }}
        >
          Accedi con un account esistente
        </PrimaryButton>
      </Shell>
    );
  }

  // UPDATE PASSWORD
  if (showUpdatePassword) {
    return (
      <Shell>
        <Eyebrow color={BLUE}>Recupero account</Eyebrow>
        <Title>NUOVA PASSWORD.</Title>
        <Subtitle>Scegli una nuova password sicura per il tuo account.</Subtitle>

        <form onSubmit={handleUpdatePassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <FieldLabel>Nuova password</FieldLabel>
            <GlassInput
              type="password"
              placeholder="Almeno 6 caratteri"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={PASSWORD_POLICY.minLength}
              required
            />
          </div>
          <div>
            <FieldLabel>Conferma password</FieldLabel>
            <GlassInput
              type="password"
              placeholder="Ripeti la password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={PASSWORD_POLICY.minLength}
              required
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <PrimaryButton type="submit" disabled={isLoading}>
              {isLoading ? "Aggiornamento…" : "Aggiorna password"}
            </PrimaryButton>
          </div>
        </form>
      </Shell>
    );
  }

  // LOGIN — Forgot Password
  if (isLogin && showForgotPassword) {
    return (
      <Shell onBack={() => setShowForgotPassword(false)} onClose={closeAuth}>
        <Eyebrow color={BLUE}>Recupero password</Eyebrow>
        <Title>SERVE UN LINK.</Title>
        <Subtitle>Inserisci l'email associata al tuo account. Ti mandiamo un link per reimpostare la password.</Subtitle>

        <form onSubmit={handlePasswordReset} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <FieldLabel>Email</FieldLabel>
            <GlassInput
              type="email"
              placeholder="nome@dominio.it"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <PrimaryButton type="submit" disabled={isLoading || !resetEmail}>
              {isLoading ? "Invio…" : "Invia link di recupero"}
            </PrimaryButton>
          </div>
        </form>
      </Shell>
    );
  }

  // LOGIN
  if (isLogin) {
    return (
      <Shell onClose={closeAuth}>
        <Eyebrow color={BLUE}>
          <LogoVertical hideText={true} className="w-4 h-4" />
          <span>Accedi</span>
        </Eyebrow>
        <Title>
          BENTORNATO
          <br />
          SU NOPARROT.
        </Title>
        <Subtitle>Riprendi da dove avevi lasciato.</Subtitle>

        <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <FieldLabel>Email</FieldLabel>
            <GlassInput
              type="email"
              placeholder="nome@dominio.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <GlassInput
              type="password"
              placeholder="La tua password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <PrimaryButton type="submit" disabled={isLoading}>
              {isLoading ? "Caricamento…" : "Accedi"}
            </PrimaryButton>
          </div>
        </form>

        <Divider label="oppure" />
        <GoogleButton onClick={handleGoogle} label="Continua con Google" />

        <div style={{ marginTop: 10 }}>
          <GhostLink onClick={() => setShowForgotPassword(true)}>Password dimenticata?</GhostLink>
        </div>
        <div style={{ marginTop: -4 }}>
          <GhostLink onClick={() => { setIsLogin(false); setRegistrationStep(1); }}>
            Non hai un account? Registrati →
          </GhostLink>
        </div>
      </Shell>
    );
  }

  // ==================================================================
  // REGISTRATION FLOW
  // ==================================================================

  // STEP 1 — DATA
  if (registrationStep === 1) {
    const canContinue = !!(fullName.trim() && email && dayOfBirth && monthOfBirth && yearOfBirth);
    return (
      <Shell onClose={closeAuth}>
        <Eyebrow color={BLUE}>
          <LogoVertical hideText={true} className="w-4 h-4" />
          <span>Passo 1 · 3 — I tuoi dati</span>
        </Eyebrow>
        <Title>CHI SEI.</Title>
        <StepRail current={1} total={3} />

        <form onSubmit={handleStep1Submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <FieldLabel>Nome completo</FieldLabel>
            <GlassInput
              type="text"
              placeholder="Come ti chiami"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div>
            <FieldLabel>Email</FieldLabel>
            <GlassInput
              type="email"
              placeholder="nome@dominio.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <FieldLabel>Data di nascita</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: 8 }}>
              <GlassSelect value={dayOfBirth} onValueChange={setDayOfBirth} placeholder="Giorno">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                ))}
              </GlassSelect>
              <GlassSelect value={monthOfBirth} onValueChange={setMonthOfBirth} placeholder="Mese">
                {["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"].map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </GlassSelect>
              <GlassSelect value={yearOfBirth} onValueChange={setYearOfBirth} placeholder="Anno">
                {Array.from({ length: 85 }, (_, i) => new Date().getFullYear() - 16 - i).map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </GlassSelect>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: TXT_MUTED, marginTop: 6 }}>
              Almeno 16 anni
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <PrimaryButton type="submit" disabled={!canContinue}>Avanti →</PrimaryButton>
          </div>
        </form>

        <Divider label="oppure" />
        <GoogleButton onClick={handleGoogle} label="Registrati con Google" />

        <div style={{ marginTop: 10 }}>
          <GhostLink onClick={() => setIsLogin(true)}>Hai già un account? Accedi</GhostLink>
        </div>
      </Shell>
    );
  }

  // STEP 2 — PASSWORD
  if (registrationStep === 2) {
    const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
    const canContinue = pwChecks.ok && passwordsMatch;
    return (
      <Shell onBack={() => setRegistrationStep(1)} onClose={closeAuth}>
        <Eyebrow color={BLUE}>Passo 2 · 3 — La tua password</Eyebrow>
        <Title>UNA CHIAVE FORTE.</Title>
        <StepRail current={2} total={3} />

        <form onSubmit={handleStep2Submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <FieldLabel>Password</FieldLabel>
            <GlassInput
              type="password"
              placeholder="Almeno 6 caratteri"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={PASSWORD_POLICY.minLength}
              required
              autoComplete="new-password"
              ok={pwChecks.ok}
            />
          </div>
          <div>
            <FieldLabel>Conferma password</FieldLabel>
            <GlassInput
              type="password"
              placeholder="Ripeti la password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={PASSWORD_POLICY.minLength}
              required
              autoComplete="new-password"
              invalid={confirmPassword.length > 0 && password !== confirmPassword}
              ok={passwordsMatch}
            />
          </div>

          {(password.length > 0 || confirmPassword.length > 0) && (
            <div
              style={{
                background: "rgba(26, 35, 54, 0.72)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 14,
                padding: 14,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 9.5,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: TXT_MUTED,
                  marginBottom: 10,
                }}
              >
                Requisiti
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {pwChecks.checks.map((c) => (
                  <li
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontFamily: "Inter, sans-serif",
                      fontSize: 13,
                      color: c.ok ? TEAL : TXT_SOFT,
                    }}
                  >
                    {c.ok ? <Check size={14} strokeWidth={2.5} /> : <Circle size={14} strokeWidth={1.6} />}
                    <span>{c.label}</span>
                  </li>
                ))}
                {confirmPassword.length > 0 && (
                  <li
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontFamily: "Inter, sans-serif",
                      fontSize: 13,
                      color: passwordsMatch ? TEAL : TXT_SOFT,
                    }}
                  >
                    {passwordsMatch ? <Check size={14} strokeWidth={2.5} /> : <Circle size={14} strokeWidth={1.6} />}
                    <span>Le due password coincidono</span>
                  </li>
                )}
              </ul>
            </div>
          )}

          <div style={{ marginTop: 6 }}>
            <PrimaryButton type="submit" disabled={!canContinue}>Avanti →</PrimaryButton>
          </div>
        </form>
      </Shell>
    );
  }

  // STEP 3 — CONSENT + signUpStep1
  if (registrationStep === 3) {
    const canContinue = termsAccepted && privacyAcknowledged && !isLoading;
    return (
      <Shell onBack={() => setRegistrationStep(2)} onClose={closeAuth}>
        <Eyebrow color={BLUE}>Passo 3 · 3 — Le regole del patto</Eyebrow>
        <Title>
          I DATI
          <br />
          SERVONO A TE.
        </Title>
        <Subtitle>
          Non vendiamo la tua identità. La tua nebulosa cognitiva serve a te, non al mercato.
          Tutto sotto il tuo controllo, sempre reversibile.
        </Subtitle>
        <StepRail current={3} total={3} />

        <form onSubmit={handleStep3Submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Mandatory toggles */}
          <ConsentRow
            checked={termsAccepted}
            onToggle={() => setTermsAccepted((v) => !v)}
            title="Accetto i Termini di Servizio"
            required
            link={{ href: "/terms", label: "Leggi i Termini" }}
          />
          <ConsentRow
            checked={privacyAcknowledged}
            onToggle={() => setPrivacyAcknowledged((v) => !v)}
            title="Ho letto la Privacy Policy"
            required
            link={{ href: "/privacy", label: "Leggi la Policy" }}
          />

          {/* Optional toggles */}
          <ConsentRow
            checked={cognitiveOptIn}
            onToggle={() => setCognitiveOptIn((v) => !v)}
            title="Attiva la Mappa Cognitiva"
            hint="Traccia i temi che comprendi per personalizzare il feed."
          />
          <ConsentRow
            checked={adsOptIn}
            onToggle={() => setAdsOptIn((v) => !v)}
            title="Annunci personalizzati"
            hint="Se disattivato vedrai solo annunci contestuali."
          />

          <div style={{ marginTop: 10 }}>
            <PrimaryButton type="submit" disabled={!canContinue}>
              {isLoading ? "Creazione account…" : "Crea il tuo account →"}
            </PrimaryButton>
          </div>
        </form>
      </Shell>
    );
  }

  // STEP 4 — OTP
  if (registrationStep === 4) {
    return (
      <Shell onBack={() => setRegistrationStep(3)} onClose={closeAuth}>
        <Eyebrow color={BLUE}>Verifica email</Eyebrow>
        <Title>CONTROLLA LA POSTA.</Title>
        <Subtitle>
          Abbiamo inviato un codice a 6 cifre a <strong style={{ color: TXT, fontWeight: 600 }}>{email}</strong>.
          Inseriscilo qui sotto per confermare.
        </Subtitle>

        <form onSubmit={handleOtpSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <PrimaryButton type="submit" disabled={isLoading || otp.length !== 6}>
            {isLoading ? "Verifica…" : "Verifica codice"}
          </PrimaryButton>
        </form>
      </Shell>
    );
  }

  // STEP 5 — USERNAME + AVATAR
  if (registrationStep === 5) {
    const canContinue =
      !isLoading &&
      username.length >= 4 &&
      username.length <= 15 &&
      usernameAvailable !== false;
    return (
      <Shell onClose={closeAuth}>
        <Eyebrow color={TEAL}>Ultimo passo</Eyebrow>
        <Title>METTICI LA FACCIA.</Title>
        <Subtitle>Scegli un username e, se vuoi, una foto profilo.</Subtitle>

        <form onSubmit={handleAvatarSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
            <div style={{ position: "relative" }}>
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Preview"
                  style={{ width: 108, height: 108, borderRadius: 54, objectFit: "cover", boxShadow: "0 20px 40px rgba(0,0,0,0.35)" }}
                />
              ) : (
                <div
                  style={{
                    width: 108,
                    height: 108,
                    borderRadius: 54,
                    background: `linear-gradient(135deg, ${BLUE} 0%, #4C1D95 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: TXT,
                    fontFamily: ANTON,
                    fontSize: 40,
                    letterSpacing: "0.02em",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
                  }}
                >
                  {fullName ? getInitials(fullName) : "?"}
                </div>
              )}
              <label
                htmlFor="avatar-upload"
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: TXT,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
                }}
              >
                <Camera size={18} color={BASE} strokeWidth={2.2} />
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: "none" }}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Username</FieldLabel>
            <GlassInput
              type="text"
              placeholder="nomeutente"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              minLength={4}
              maxLength={15}
              pattern="[a-zA-Z0-9_]+"
              required
              invalid={usernameAvailable === false}
              ok={usernameAvailable === true}
            />
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginTop: 6,
                color:
                  usernameAvailable === false
                    ? PINK
                    : usernameAvailable === true
                    ? TEAL
                    : TXT_MUTED,
              }}
            >
              {checkingUsername
                ? "Verifica…"
                : usernameAvailable === false
                ? "Username già in uso"
                : usernameAvailable === true
                ? "Username disponibile"
                : "4-15 caratteri: lettere, numeri, underscore"}
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <PrimaryButton type="submit" disabled={!canContinue}>
              {isLoading ? "Completamento…" : "Entra su NoParrot →"}
            </PrimaryButton>
          </div>
        </form>
      </Shell>
    );
  }

  return null;
};

// ------------------------------------------------------------------
// Consent row — glass card with radio-style checkbox and optional link
// ------------------------------------------------------------------
function ConsentRow({
  checked,
  onToggle,
  title,
  hint,
  link,
  required,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  hint?: string;
  link?: { href: string; label: string };
  required?: boolean;
}) {
  return (
    <div
      style={{
        background: "rgba(26, 35, 54, 0.72)",
        border: `1px solid ${checked ? "rgba(10,122,255,0.45)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 16,
        padding: 14,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        cursor: "pointer",
        transition: "border-color 180ms ease",
      }}
      onClick={onToggle}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: 6,
          background: checked ? BLUE : "rgba(255,255,255,0.06)",
          border: `1px solid ${checked ? BLUE : "rgba(255,255,255,0.14)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
          transition: "all 180ms ease",
        }}
      >
        {checked ? <Check size={14} strokeWidth={3} color="#FFFFFF" /> : null}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 14.5,
            fontWeight: 600,
            color: TXT,
            lineHeight: 1.35,
          }}
        >
          {title}
          {required ? <span style={{ color: PINK, marginLeft: 4 }}>*</span> : null}
        </div>
        {hint ? (
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, color: TXT_MUTED, marginTop: 3, lineHeight: 1.4 }}>
            {hint}
          </div>
        ) : null}
        {link ? (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginTop: 6,
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: BLUE,
              textDecoration: "none",
            }}
          >
            {link.label} <ExternalLink size={11} />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default AuthPage;