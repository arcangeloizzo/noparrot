import { cn } from "@/lib/utils";
import { LOGO_BASE, LOGO_EXTENDED, LOGO_WHITE } from "@/config/brand";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "icon" | "wordmark" | "extended" | "white";
  dark?: boolean;
  id?: string;
  onClick?: () => void;
}

export const Logo = ({ className, size = "md", variant = "icon", dark = false, id, onClick }: LogoProps) => {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8", 
    lg: "w-12 h-12",
    xl: "w-16 h-16"
  };

  const heightClasses = {
    sm: "h-4",
    md: "h-6", 
    lg: "h-8",
    xl: "h-10"
  };

  const clickableClasses = onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : "";

  if (variant === "icon") {
    return (
      <img 
        id={id}
        src={LOGO_BASE} 
        alt="NOPARROT" 
        className={cn(sizeClasses[size], clickableClasses, className)}
        onClick={onClick}
      />
    );
  }

  if (variant === "wordmark") {
    return (
      <div 
        className={cn("font-semibold text-foreground", clickableClasses, className)}
        onClick={onClick}
      >
        <span className="text-muted-foreground">NO</span>
        <span className="text-primary-blue">PARROT</span>
      </div>
    );
  }

  if (variant === "extended") {
    return (
      <img 
        id={id}
        src={LOGO_EXTENDED} 
        alt="NOPARROT" 
        className={cn(heightClasses[size], "w-auto", clickableClasses, className)}
        onClick={onClick}
      />
    );
  }

  if (variant === "white") {
    return (
      <img 
        id={id}
        src={LOGO_WHITE} 
        alt="NOPARROT" 
        className={cn(sizeClasses[size], clickableClasses, className)}
        onClick={onClick}
      />
    );
  }

  return (
    <div 
      className={cn("flex items-center space-x-2", clickableClasses, className)}
      onClick={onClick}
    >
      <img 
        src={LOGO_BASE} 
        alt="NOPARROT" 
        className={sizeClasses[size]}
      />
      <div className="font-semibold text-foreground">
        <span className="text-muted-foreground">NO</span>
        <span className="text-primary-blue">PARROT</span>
      </div>
    </div>
  );
};