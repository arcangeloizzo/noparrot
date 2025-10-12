import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/ui/logo";
import { TrustBadge } from "@/components/ui/trust-badge";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const AuthPage = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message === 'Invalid login credentials' 
            ? 'Email o password non corretti' 
            : error.message);
        } else {
          toast.success('Login effettuato!');
        }
      } else {
        if (password !== confirmPassword) {
          toast.error('Le password non corrispondono');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          toast.error('La password deve essere di almeno 6 caratteri');
          setIsLoading(false);
          return;
        }
        const { error } = await signUp(email, password, fullName);
        if (error) {
          toast.error(error.message === 'User already registered' 
            ? 'Questo email è già registrata' 
            : error.message);
        } else {
          toast.success('Account creato! Accesso effettuato.');
        }
      }
    } catch (error) {
      toast.error('Si è verificato un errore. Riprova.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <Logo size="lg" />
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              {isLogin ? "Bentornato!" : "Crea il tuo account"}
            </h1>
            <p className="text-muted-foreground">
              {isLogin 
                ? "Accedi per continuare a combattere la disinformazione" 
                : "Unisciti alla community per un'informazione più consapevole"}
            </p>
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <Input
                type="text"
                placeholder="Nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-12"
                required
              />
            )}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12"
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12"
              required
            />
            {!isLogin && (
              <Input
                type="password"
                placeholder="Conferma Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12"
                required
              />
            )}

            <Button 
              type="submit" 
              className="w-full h-12 bg-primary hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading ? "Caricamento..." : isLogin ? "Accedi" : "Registrati"}
              {!isLoading && <ChevronRight className="ml-2 h-5 w-5" />}
            </Button>
          </form>

          <Separator className="my-6" />

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              {isLogin ? "Non hai un account?" : "Hai già un account?"}
            </p>
            <Button
              variant="ghost"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:text-primary/90"
              disabled={isLoading}
            >
              {isLogin ? "Registrati ora" : "Accedi"}
            </Button>
          </div>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>Sistema sicuro e protetto 🔒</p>
        </div>
      </div>
    </div>
  );
};
