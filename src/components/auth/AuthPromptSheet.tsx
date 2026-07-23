import { useLocation, useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { haptics } from "@/lib/haptics";

interface AuthPromptSheetProps {
  open: boolean;
  onClose: () => void;
}

export const AuthPromptSheet = ({ open, onClose }: AuthPromptSheetProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleGoAuth = () => {
    haptics.medium();
    const from = `${location.pathname}${location.search}`;
    onClose();
    navigate(`/auth?redirect=${encodeURIComponent(from)}`);
  };

  const handleKeepReading = () => {
    haptics.light();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="border-none p-0 z-[80]"
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{
          background: "rgba(14, 21, 34, 0.86)",
          backdropFilter: "blur(26px) saturate(160%)",
          WebkitBackdropFilter: "blur(26px) saturate(160%)",
          boxShadow: "0 -1px 0 rgba(255,255,255,0.08) inset, 0 -24px 60px rgba(0,0,0,0.55)",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
      >
        <div
          style={{
            padding: "28px 24px 32px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2
              style={{
                fontFamily: "'Anton', 'Impact', sans-serif",
                fontSize: 34,
                lineHeight: 0.98,
                letterSpacing: "0.01em",
                color: "#FFFFFF",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              Entra su NoParrot
            </h2>
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 15,
                lineHeight: 1.45,
                color: "rgba(255,255,255,0.72)",
                margin: 0,
              }}
            >
              Per mettere like, salvare e commentare serve un account.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Button
              onClick={handleGoAuth}
              className="w-full rounded-full"
              style={{
                height: 52,
                background: "#0A7AFF",
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: 15,
                letterSpacing: "0.01em",
                boxShadow: "0 8px 24px rgba(10,122,255,0.35)",
              }}
            >
              Accedi o registrati
            </Button>
            <Button
              onClick={handleKeepReading}
              variant="ghost"
              className="w-full rounded-full"
              style={{
                height: 48,
                color: "rgba(255,255,255,0.72)",
                fontWeight: 500,
                fontSize: 14,
                background: "transparent",
              }}
            >
              Continua a leggere
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};