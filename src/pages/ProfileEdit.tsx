import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { X, Camera } from "lucide-react";
import { toast } from "sonner";

export const ProfileEdit = () => {
  const { user, updateProfile, updateAvatar, verifyEmailChangeOTP } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [showEmailOTPModal, setShowEmailOTPModal] = useState(false);
  const [emailOTP, setEmailOTP] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setEmail(user?.email || "");
    }
  }, [profile, user]);

  const handleSave = async () => {
    setIsLoading(true);

    if (avatarFile) {
      const { error } = await updateAvatar(avatarFile);
      if (error) {
        toast.error("Errore caricamento avatar");
        setIsLoading(false);
        return;
      }
    }

    const { error, requiresEmailVerification } = await updateProfile({
      full_name: fullName,
      username: username !== profile?.username ? username : undefined, // Solo se modificato
      bio,
      email: email !== user?.email ? email : undefined,
    });

    if (error) {
      toast.error(error.message);
    } else if (requiresEmailVerification) {
      toast.success("Codice di verifica inviato alla nuova email");
      setShowEmailOTPModal(true);
    } else {
      toast.success("Profilo aggiornato!");
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      navigate("/profile");
    }

    setIsLoading(false);
  };

  const handleVerifyEmailOTP = async () => {
    setIsLoading(true);

    const { error } = await verifyEmailChangeOTP(email, emailOTP);

    if (error) {
      toast.error("Codice non valido");
    } else {
      toast.success("Email aggiornata!");
      setShowEmailOTPModal(false);
      navigate("/profile");
    }

    setIsLoading(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAvatarFile(file);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <div className="min-h-screen bg-background pb-24">
        <div className="max-w-[600px] mx-auto">
          {/* Header */}
          <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-50 border-b border-border">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                  <X className="w-5 h-5" />
                </Button>
                <h1 className="text-xl font-bold">Modifica profilo</h1>
              </div>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? "Salvataggio..." : "Salva"}
              </Button>
            </div>
          </div>

          {/* Cover */}
          <div className="h-48 bg-primary/10 relative">
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            >
              <Camera className="w-5 h-5" />
            </Button>
          </div>

          {/* Avatar */}
          <div className="px-4 pb-4">
            <div className="relative -mt-16 mb-6">
              {avatarFile ? (
                <img
                  src={URL.createObjectURL(avatarFile)}
                  alt="Preview"
                  className="w-32 h-32 rounded-full border-4 border-background object-cover"
                />
              ) : profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-32 h-32 rounded-full border-4 border-background object-cover"
                />
              ) : (
                <div className="w-32 h-32 rounded-full border-4 border-background bg-primary flex items-center justify-center text-4xl font-semibold text-primary-foreground">
                  {getInitials(fullName)}
                </div>
              )}
              <label
                htmlFor="avatar-edit"
                className="absolute bottom-0 right-0 bg-primary rounded-full p-3 cursor-pointer hover:bg-primary/90"
              >
                <Camera className="w-5 h-5 text-primary-foreground" />
              </label>
              <input
                id="avatar-edit"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {/* Form */}
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Nome</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Username</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="nomeutente"
                  minLength={4}
                  maxLength={15}
                  pattern="[a-zA-Z0-9_]+"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  4-15 caratteri: solo lettere, numeri e underscore
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Bio</label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Raccontaci di te..."
                  rows={4}
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/160</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@esempio.com"
                />
                {email !== user?.email && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Modificare l'email richiede verifica via codice OTP
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Data di nascita</label>
                <Input
                  type="text"
                  value={
                    profile?.date_of_birth
                      ? new Date(profile.date_of_birth).toLocaleDateString("it-IT")
                      : "Non disponibile"
                  }
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  La data di nascita non può essere modificata
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal OTP Email */}
      {showEmailOTPModal && (
        <Dialog open={showEmailOTPModal} onOpenChange={setShowEmailOTPModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verifica nuova email</DialogTitle>
              <DialogDescription>Inserisci il codice a 6 cifre inviato a {email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <InputOTP maxLength={6} value={emailOTP} onChange={setEmailOTP}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              <Button
                onClick={handleVerifyEmailOTP}
                disabled={isLoading || emailOTP.length !== 6}
                className="w-full"
              >
                {isLoading ? "Verifica..." : "Conferma"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default ProfileEdit;
