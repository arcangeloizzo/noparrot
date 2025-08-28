import { cn } from "@/lib/utils";
import { LOGO_BASE, LOGO_BASE_DARK, LOGO_EXTENDED, LOGO_EXTENDED_DARK } from "@/config/brand";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "icon" | "wordmark" | "extended";
  dark?: boolean;
  id?: string;
}

export const Logo = ({ className, size = "md", variant = "icon", dark = false, id }: LogoProps) => {
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

  if (variant === "icon") {
    return (
      <img 
        id={id}
        src={dark ? LOGO_BASE_DARK : LOGO_BASE} 
        alt="NOPARROT" 
        className={cn(sizeClasses[size], className)}
      />
    );
  }

  if (variant === "wordmark") {
    return (
      <div className={cn("font-semibold text-foreground", className)}>
        <span className="text-muted-foreground">NO</span>
        <span className="text-primary-blue">PARROT</span>
      </div>
    );
  }

  if (variant === "extended") {
    return (
      <img 
        id={id}
        src={dark ? LOGO_EXTENDED_DARK : LOGO_EXTENDED} 
        alt="NOPARROT" 
        className={cn(heightClasses[size], "w-auto", className)}
      />
    );
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <img 
        src={dark ? LOGO_BASE_DARK : LOGO_BASE} 
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