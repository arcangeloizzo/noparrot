import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppleIcon, GoogleIcon, LinkedInIcon, ArrowLeftIcon } from "@/components/ui/icons";

interface AuthPageProps {
  mode: "login" | "signup";
  onSubmit: (email: string, password: string) => void;
  onBack: () => void;
  onToggleMode: () => void;
  onComplete: () => void;
}

export const AuthPage = ({ mode, onSubmit, onBack, onToggleMode, onComplete }: AuthPageProps) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email, password);
  };

  const handleSocialLogin = () => {
    localStorage.setItem("noparrot-onboarded", "true");
    onComplete();
  };

  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 text-foreground hover:text-primary-blue transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6">
          <Card className="shadow-card border-border/50">
            <CardHeader className="text-center">
              <CardTitle className="text-xl font-semibold text-foreground">
                {isSignup ? "Create Account" : "Welcome Back"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="rounded-md"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="rounded-md"
                    required
                  />
                </div>

                {isSignup && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                      Confirm Password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="rounded-md"
                      required
                    />
                  </div>
                )}

                <Button 
                  type="submit"
                  className="w-full bg-primary-blue hover:bg-primary-blue/90 text-white font-semibold py-3 rounded-full h-11"
                >
                  {isSignup ? "Sign Up" : "Log In"}
                </Button>
              </form>

              {/* Social Login */}
              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    onClick={handleSocialLogin}
                    className="w-full bg-black hover:bg-black/90 text-white border-black rounded-md h-11"
                  >
                    <AppleIcon className="w-5 h-5 mr-2" />
                    Apple
                  </Button>

                  <Button 
                    variant="outline" 
                    onClick={handleSocialLogin}
                    className="w-full bg-white hover:bg-gray-50 text-gray-700 border-gray-300 rounded-md h-11"
                  >
                    <GoogleIcon className="w-5 h-5 mr-2" />
                    Google
                  </Button>

                  <Button 
                    variant="outline" 
                    onClick={handleSocialLogin}
                    className="w-full bg-[#0A66C2] hover:bg-[#0A66C2]/90 text-white border-[#0A66C2] rounded-md h-11"
                  >
                    <LinkedInIcon className="w-4 h-4 mr-2" />
                    LinkedIn
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Toggle Mode */}
          <div className="text-center">
            <span className="text-sm text-muted-foreground">
              {isSignup ? "Already have an account?" : "Don't have an account?"}
            </span>
            <button 
              onClick={onToggleMode}
              className="ml-1 text-sm text-primary-blue hover:text-primary-blue/80 font-medium transition-colors"
            >
              {isSignup ? "Log in" : "Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};