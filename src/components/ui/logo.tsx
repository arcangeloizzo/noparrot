import { cn } from "@/lib/utils";
import parrotLogo from "@/assets/parrot-logo.png";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "icon" | "wordmark" | "full";
}

export const Logo = ({ className, size = "md", variant = "icon" }: LogoProps) => {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8", 
    lg: "w-12 h-12",
    xl: "w-16 h-16"
  };

  if (variant === "icon") {
    return (
      <img 
        src={parrotLogo} 
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

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <img 
        src={parrotLogo} 
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