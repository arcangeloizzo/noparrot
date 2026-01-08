import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Camera } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface AuthPageProps {
  initialMode?: 'login' | 'signup';
  forcePasswordReset?: boolean;
}

export const AuthPage = ({ initialMode = 'login', forcePasswordReset = false }: AuthPageProps) => {
  const navigate = useNavigate();
  const { user, signIn, signUpStep1, verifyEmailOTP, completeProfile } = useAuth();
  
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [registrationStep, setRegistrationStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showUpdatePassword, setShowUpdatePassword] = useState(forcePasswordReset);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 1 data
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dayOfBirth, setDayOfBirth] = useState("");
  const [monthOfBirth, setMonthOfBirth] = useState("");
  const [yearOfBirth, setYearOfBirth] = useState("");

  // Step 2 data
  const [otp, setOtp] = useState("");

  // Step 3 data
  const [username, setUsername] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  useEffect(() => {
    // NON reindirizzare se siamo in modalità update password
    if (user && !showUpdatePassword) {
      navigate("/");
    }
  }, [user, navigate, showUpdatePassword]);

  // Auto-suggerimento username da email
  useEffect(() => {
    if (email && email.includes('@') && !username) {
      const suggestedUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      setUsername(suggestedUsername.toLowerCase());
    }
  }, [email]);

  // Verifica disponibilità username con debounce
  useEffect(() => {
    if (!username || username.length < 4) {
      setUsernameAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (error) {
        console.error('Error checking username:', error);
        setUsernameAvailable(null);
      } else {
        setUsernameAvailable(data === null);
      }
      setCheckingUsername(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!fullName || !email || !password || !confirmPassword || !dayOfBirth || !monthOfBirth || !yearOfBirth || !username) {
      toast.error("Compila tutti i campi");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Le password non corrispondono");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.error("La password deve essere almeno 6 caratteri");
      setIsLoading(false);
      return;
    }

    if (usernameAvailable === false) {
      toast.error("Scegli un username diverso");
      setIsLoading(false);
      return;
    }

    const dateOfBirth = `${yearOfBirth}-${monthOfBirth.padStart(2, "0")}-${dayOfBirth.padStart(2, "0")}`;
    const cleanFullName = fullName.trim() || null;
    const { error } = await signUpStep1(email, password, cleanFullName, dateOfBirth);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Codice di verifica inviato alla tua email!");
      setRegistrationStep(2);
    }
    setIsLoading(false);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (otp.length !== 6) {
      toast.error("Inserisci il codice a 6 cifre");
      setIsLoading(false);
      return;
    }

    const { error } = await verifyEmailOTP(email, otp);

    if (error) {
      toast.error("Codice non valido");
    } else {
      toast.success("Email verificata!");
      setRegistrationStep(3);
    }
    setIsLoading(false);
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!username || username.length < 4 || username.length > 15) {
      toast.error("Username deve essere 4-15 caratteri");
      setIsLoading(false);
      return;
    }

    const { error } = await completeProfile(username, avatarFile || undefined);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Registrazione completata!");
      navigate("/");
    }
    setIsLoading(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Email o password non corretti" : error.message);
    } else {
      toast.success("Login effettuato!");
      navigate("/");
    }
    setIsLoading(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/`,
    });

    if (error) {
      toast.error(error.message);
    } else {
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

    if (newPassword.length < 6) {
      toast.error("La password deve essere almeno 6 caratteri");
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ 
      password: newPassword 
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password aggiornata con successo!");
      setShowUpdatePassword(false);
      setNewPassword("");
      setConfirmPassword("");
      // Pulisci l'hash dall'URL
      window.history.replaceState({}, document.title, window.location.pathname);
      navigate("/");
    }
    setIsLoading(false);
  };

  // UPDATE PASSWORD VIEW
  if (showUpdatePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md p-6 rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
          <div className="text-center mb-6">
            <Logo className="w-auto h-12 mx-auto" />
            <h1 className="text-2xl font-bold mt-4">Imposta Nuova Password</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Scegli una nuova password per il tuo account
            </p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <Input 
              type="password" 
              placeholder="Nuova password" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              className="focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
              required 
              minLength={6}
            />
            <Input 
              type="password" 
              placeholder="Conferma password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              className="focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
              required 
              minLength={6}
            />
            <Button 
              type="submit" 
              className="w-full shadow-[inset_0_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]" 
              disabled={isLoading}
            >
              {isLoading ? "Aggiornamento..." : "Aggiorna password"}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  // LOGIN VIEW
  if (isLogin) {
    if (showForgotPassword) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <Card className="w-full max-w-md p-6 rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
            <div className="text-center mb-6">
              <Logo className="w-auto h-12 mx-auto" />
              <h1 className="text-2xl font-bold mt-4">Recupera Password</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Inserisci la tua email per ricevere il link di recupero
              </p>
            </div>

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <Input 
                type="email" 
                placeholder="Email" 
                value={resetEmail} 
                onChange={(e) => setResetEmail(e.target.value)} 
                className="focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
                required 
              />
              <Button 
                type="submit" 
                className="w-full shadow-[inset_0_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]" 
                disabled={isLoading}
              >
                {isLoading ? "Invio..." : "Invia link di recupero"}
              </Button>
            </form>

            <Button 
              variant="ghost" 
              className="w-full mt-4" 
              onClick={() => setShowForgotPassword(false)}
            >
              ← Torna al login
            </Button>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md p-6 rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
          <div className="text-center mb-6">
            <Logo className="w-auto h-12 mx-auto" />
            <h1 className="text-2xl font-bold mt-4">Accedi a NoParrot</h1>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <Input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
              required 
            />
            <Input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
              required 
            />
            <Button 
              type="submit" 
              className="w-full shadow-[inset_0_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]" 
              disabled={isLoading}
            >
              {isLoading ? "Caricamento..." : "Accedi"}
            </Button>
          </form>

          <Button 
            variant="ghost" 
            className="w-full mt-2" 
            onClick={() => setShowForgotPassword(true)}
          >
            Password dimenticata?
          </Button>

          <Button variant="ghost" className="w-full mt-2" onClick={() => { setIsLogin(false); setRegistrationStep(1); }}>
            Non hai un account? Registrati
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Accedendo o creando un account, accetti i{" "}
            <a href="/terms" className="text-primary underline">Termini di Servizio</a>
            {" "}e la{" "}
            <a href="/privacy" className="text-primary underline">Privacy Policy</a>.
          </p>
        </Card>
      </div>
    );
  }

  // REGISTRAZIONE STEP 1: Dati base
  if (registrationStep === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md p-6 rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
          <div className="text-center mb-6">
            <Logo className="w-auto h-12 mx-auto" />
            <h1 className="text-2xl font-bold mt-4">Crea il tuo account</h1>
          </div>

          <form onSubmit={handleStep1Submit} className="space-y-4">
            <Input type="text" placeholder="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome utente</label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="nomeutente"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  required
                  minLength={4}
                  maxLength={15}
                  pattern="[a-zA-Z0-9_]+"
                  className={usernameAvailable === false ? 'border-destructive' : usernameAvailable === true ? 'border-green-500' : ''}
                />
                {checkingUsername && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    Verifica...
                  </span>
                )}
              </div>
              {usernameAvailable === false && (
                <p className="text-xs text-destructive">Username già in uso</p>
              )}
              {usernameAvailable === true && (
                <p className="text-xs text-green-600">Username disponibile</p>
              )}
              <p className="text-xs text-muted-foreground">4-15 caratteri: solo lettere, numeri e underscore</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data di nascita</label>
              <div className="grid grid-cols-3 gap-2">
                <Select value={dayOfBirth} onValueChange={setDayOfBirth}>
                  <SelectTrigger><SelectValue placeholder="Giorno" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={String(day)}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={monthOfBirth} onValueChange={setMonthOfBirth}>
                  <SelectTrigger><SelectValue placeholder="Mese" /></SelectTrigger>
                  <SelectContent>
                    {["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"].map((month, idx) => (
                      <SelectItem key={idx + 1} value={String(idx + 1)}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={yearOfBirth} onValueChange={setYearOfBirth}>
                  <SelectTrigger><SelectValue placeholder="Anno" /></SelectTrigger>
                  <SelectContent>
                    {/* Start from 16 years ago (min age) to 100 years ago */}
                    {Array.from({ length: 85 }, (_, i) => new Date().getFullYear() - 16 - i).map((year) => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Per iscriverti devi avere almeno 16 anni</p>
            </div>

            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            <Input type="password" placeholder="Conferma password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Caricamento..." : "Avanti"}
            </Button>
          </form>

          <Button variant="ghost" className="w-full mt-4" onClick={() => setIsLogin(true)}>
            Hai già un account? Accedi
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Accedendo o creando un account, accetti i{" "}
            <a href="/terms" className="text-primary underline">Termini di Servizio</a>
            {" "}e la{" "}
            <a href="/privacy" className="text-primary underline">Privacy Policy</a>.
          </p>
        </Card>
      </div>
    );
  }

  // REGISTRAZIONE STEP 2: Verifica OTP
  if (registrationStep === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md p-6 rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
          <div className="text-center mb-6">
            <Logo />
            <h1 className="text-2xl font-bold mt-4">Verifica la tua email</h1>
            <p className="text-sm text-muted-foreground mt-2">Abbiamo inviato un codice a {email}</p>
          </div>

          <form onSubmit={handleStep2Submit} className="space-y-4">
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

            <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
              {isLoading ? "Verifica..." : "Verifica codice"}
            </Button>
          </form>

          <Button variant="ghost" className="w-full mt-4" onClick={() => setRegistrationStep(1)}>
            ← Indietro
          </Button>
        </Card>
      </div>
    );
  }

  // REGISTRAZIONE STEP 3: Solo Avatar (username già inserito)
  if (registrationStep === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md p-6 rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
          <div className="text-center mb-6">
            <Logo />
            <h1 className="text-2xl font-bold mt-4">Completa il tuo profilo</h1>
          </div>

          <form onSubmit={handleStep3Submit} className="space-y-6">
            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" className="w-24 h-24 rounded-full object-cover" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-2xl font-semibold text-primary-foreground">
                    {fullName ? getInitials(fullName) : "?"}
                  </div>
                )}
                <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-primary rounded-full p-2 cursor-pointer hover:bg-primary/90">
                  <Camera className="w-5 h-5 text-primary-foreground" />
                </label>
                <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </div>
              <p className="text-xs text-muted-foreground">Carica una foto profilo (opzionale)</p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Completamento..." : "Completa registrazione"}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return null;
};
